import util from 'util'
import zlib from 'zlib'
import ipRangeCheck from 'ip-range-check'

import {publishNotification, s3} from './utils.js'

const acceptableIpRanges = process.env.IP_RANGES.split(',')

const gunzip = util.promisify(zlib.gunzip)

const EVENT_SOURCE = 'signin.amazonaws.com'
const EVENT_TYPE = 'AwsConsoleSignIn'
const EVENT_NAME = 'CheckMfa'

function isAcceptableIp(sourceIp) {
	return ipRangeCheck(sourceIp, acceptableIpRanges)
}

async function processEvent(event) {
	let srcBucket = event.Records[0].s3.bucket.name
	let srcKey = event.Records[0].s3.object.key //format is: AWSLogs/orgId/accountId/CloudTrail/region/yy/mm/dd/filename

	console.log('getting s3 object')
	console.log(`srcBucket: ${srcBucket}`)
	console.log(`srcKey: ${srcKey}`)

	let s3Response = await s3
		.getObject({
			Bucket: srcBucket,
			Key: srcKey
		})
		.promise()
	console.log('got s3 object')
	let raw = await gunzip(s3Response.Body)
	let records = JSON.parse(raw)
	return records
}

async function processRecords(records) {
	console.log(`all records (${records.Records.length}):`)
	console.log(JSON.stringify(records, null, 2))

	let matchingRecords = records.Records.filter(record => {
		let correctType =
			record.eventSource == EVENT_SOURCE && record.eventType == EVENT_TYPE && record.eventName != EVENT_NAME
		let consoleSuccess =
			record.responseElements == null ||
			record.responseElements.ConsoleLogin == null ||
			record.responseElements.ConsoleLogin == 'Success' //i.e. if there is one, it should be 'success'
		let switchSuccess =
			record.responseElements == null ||
			record.responseElements.SwitchRole == null ||
			record.responseElements.SwitchRole == 'Success' //i.e. if there is one, it should be 'success'
		return correctType && consoleSuccess && switchSuccess
	})

	console.log(`all records of the right event type (${matchingRecords.length}):`)
	console.log(JSON.stringify(matchingRecords, null, 2))

	matchingRecords = matchingRecords.filter(record => !isAcceptableIp(record.sourceIPAddress))

	console.log(`all records which have an unknown source ip (${matchingRecords.length}):`)
	console.log(JSON.stringify(matchingRecords, null, 2))

	//simple output for email
	matchingRecords = matchingRecords.map(record => {
		let userType = record.userIdentity != null ? record.userIdentity.type : '[unknown]'
		let userArn = record.userIdentity != null ? record.userIdentity.arn : '[unknown]'
		let user = `${userType} - ${userArn}`
		if (record.eventName == 'SwitchRole') {
			let from = record.additionalEventData != null ? record.additionalEventData.SwitchFrom : '[unknown]'
			user = `${user} from ${from}`
		}
		return {
			user: user,
			time: record.eventTime,
			sourceIp: record.sourceIPAddress,
			userAgent: record.userAgent,
			account: record.recipientAccountId,
			sourceData: {
				eventSource: record.eventSource,
				eventType: record.eventType,
				eventName: record.eventName,
				responseElements: record.responseElements
			}
		}
	})
	return matchingRecords
}

async function publishAlert(records, invocationId) {
	if (records.length > 0) {
		let data = JSON.stringify(records, null, 2)
		console.log('publishing sns alert')
		await publishNotification(
			`The following cloudtrail records originated from IPs that weren't in expected ranges:\n\n${data}`,
			'AWS account login alert',
			invocationId
		)
	} else {
		console.log(`not publishing sns alert, records.length=${records.length}`)
	}
}

async function handleEvent(event, context) {
	let invocationId = context.awsRequestId
	console.log(`invocationId=${invocationId}`) //just to make it easy to match up an email and a log entry
	console.log(JSON.stringify(event, null, 2))
	let records = await processEvent(event)
	let matchingRecords = await processRecords(records)
	await publishAlert(matchingRecords, invocationId)
}

export const handler = handleEvent
export {processRecords, publishAlert} //for easy testing
