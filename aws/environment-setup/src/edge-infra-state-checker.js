import AWS from 'aws-sdk'
import 'dotenv/config.js'
import {INFRA_TRACKING_SCHEMA} from './constants.js'
import {publishNotification} from './utils.js'

const {TABLE_NAME} = process.env

const dayInMillis = 24 * 60 * 60 * 1000

const docClient = new AWS.DynamoDB.DocumentClient()

async function getProblemDevices() {
	let comparisonDate = Date.now() - dayInMillis
	let params = {
		TableName: TABLE_NAME,
		FilterExpression: `#comparisonField < :comparisonDate`,
		ExpressionAttributeNames: {
			'#comparisonField': INFRA_TRACKING_SCHEMA.SK.name
		},
		ExpressionAttributeValues: {
			':comparisonDate': comparisonDate
		}
	}

	let data = await docClient.scan(params).promise()
	return data.Items
}

function parseDate(dateAsNumber) {
	try {
		let potentialDate = new Date(dateAsNumber)
		if (potentialDate == 'Invalid Date') {
			return dateAsNumber
		} else {
			return potentialDate
		}
	} catch (e) {
		return dateAsNumber
	}
}

async function publishAlert(problematicDevices, invocationId) {
	let data = problematicDevices
		.map(device => `${device[INFRA_TRACKING_SCHEMA.PK.name]}: ${parseDate(device[INFRA_TRACKING_SCHEMA.SK.name])}`)
		.join('\n')
	await publishNotification(
		`The following devices last checked in over one day ago:\n\n${data}`,
		'AWS edge device alert',
		invocationId
	)
}

async function handleEvent(event, context) {
	let invocationId = context.awsRequestId
	let problemDevices = await getProblemDevices()

	if (problemDevices.length > 0) {
		console.log(`Publishing sns alert, ${problemDevices.length} problematic items found.`)
		await publishAlert(problemDevices, invocationId)
	} else {
		console.log('Not publishing sns alert, no problematic items found.')
	}
}

export const handler = handleEvent
export {getProblemDevices} //for testing
