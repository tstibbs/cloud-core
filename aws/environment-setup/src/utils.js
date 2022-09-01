import 'dotenv/config.js'
import assert from 'assert'

import {ALERTS_TOPIC, CHILD_ACCOUNTS} from './runtime-envs.js'
import {aws, assumeRole} from './auth-utils.js'

const alertsTopic = ALERTS_TOPIC //needs to be full arn
const childAccounts = CHILD_ACCOUNTS

const athena = new aws.Athena()
const sns = new aws.SNS()
const s3 = new aws.S3()
const iam = new aws.IAM()
const iot = new aws.Iot()
const cloudWatchLogs = new aws.CloudWatchLogs()
const cloudformation = new aws.CloudFormation()
const dydbDocClient = new aws.DynamoDB.DocumentClient()

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

export function buildMultiAccountLambdaHandler(checkOneAccount, summarise) {
	const runAllChecks = async invocationId => {
		let allAcountsData = await inSeries(childAccounts, async childAccount => await checkOneAccount(childAccount))
		await summarise(invocationId, allAcountsData)
	}

	const handleEvent = buildSingleAccountLambdaHandler(runAllChecks)
	return handleEvent
}

export function buildSingleAccountLambdaHandler(delegate) {
	const handleEvent = async (event, context) => {
		let invocationId = context.awsRequestId
		console.log(`invocationId=${invocationId}`) //just to make it easy to match up an email and a log entry
		try {
			await delegate(invocationId)
		} catch (e) {
			console.error(e)
			console.log('publishing sns alert for error')
			let message = 'Error occured running tooling: \n' + e.stack + '\n' + JSON.stringify(e.originalError, null, 2)
			await publishNotification(message, 'AWS account tooling alert', invocationId)
			throw e //because we want the lambda invocation to be marked as a failure
		}
	}
	return handleEvent
}

export async function publishNotification(message, title, invocationId) {
	await sns
		.publish({
			Message: `${message}\n\ninvocationId=${invocationId}\n\n${getCurrentLambdaLogsLink()}`,
			TopicArn: alertsTopic,
			Subject: title
		})
		.promise()
	console.log('published sns alert')
}

function getCurrentLambdaLogsLink() {
	const {AWS_REGION, AWS_LAMBDA_LOG_GROUP_NAME, AWS_LAMBDA_LOG_STREAM_NAME} = process.env
	const encode = input => encodeURIComponent(encodeURIComponent(input)).replace(/%/g, '$')
	return `https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups/log-group/${encode(
		AWS_LAMBDA_LOG_GROUP_NAME
	)}/log-events/${encode(AWS_LAMBDA_LOG_STREAM_NAME)}`
}

export async function buildApiForAccount(accountId, api) {
	let oldCreds = await assumeRole(`arn:aws:iam::${accountId}:role/ParentAccountCliRole`)
	let cloudformation = new aws[api]()
	aws.config.credentials = oldCreds
	return cloudformation
}

export {s3, iam, dydbDocClient, iot, cloudWatchLogs, athena, cloudformation}
