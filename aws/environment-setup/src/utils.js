import 'dotenv/config.js'
import assert from 'assert'

import {aws, assumeRole} from './auth-utils.js'

const alertsTopic = process.env.ALERTS_TOPIC //needs to be full arn
const childAccounts = process.env.CHILD_ACCOUNTS.split(',')

const sns = new aws.SNS()
const s3 = new aws.S3()
const iam = new aws.IAM()

export function assertNotPaging(response) {
	//haven't bothered to implement paging of responses, so just check that there isn't any paging required
	assert.ok(response.NextToken == undefined) //docs say 'null' but library actually seems to be 'undefined'
}

export async function inSeries(things, executor) {
	//run in series not in parallel to avoid the rate limiting kicking in
	let all = []
	for (let thing of things) {
		let data = await executor(thing)
		all.push(data)
	}
	return all
}

export function buildHandler(checkOneAccount, summarise) {
	const runAllChecks = async (invocationId) => {
		console.log(`invocationId=${invocationId}`) //just to make it easy to match up an email and a log entry
		let allAcountsData = await inSeries(childAccounts, async childAccount => await checkOneAccount(childAccount))
		await summarise(invocationId, allAcountsData)
	}
	
	const handleEvent = async (event, context) => {
		let invocationId = context.awsRequestId
		try {
			await runAllChecks(invocationId)
		} catch (e) {
			console.error(e)
			console.log('publishing sns alert for error')
			let message = 'Error occured running tooling: \n' + e.stack + '\n' + JSON.stringify(e.originalError, null, 2)
			await publishNotification(message, 'AWS account tooling alert', invocationId)
		}
	}

	return handleEvent
}

export async function publishNotification(message, title, invocationId) {
	await sns
		.publish({
			Message: `${message}\n\ninvocationId=${invocationId}`,
			TopicArn: alertsTopic,
			Subject: title
		})
		.promise()
	console.log('published sns alert')
}

export async function buildApiForAccount(accountId, api) {
	let oldCreds = await assumeRole(`arn:aws:iam::${accountId}:role/ParentAccountCliRole`)
	let cloudformation = new aws[api]()
	aws.config.credentials = oldCreds
	return cloudformation
}

export {s3, iam}
