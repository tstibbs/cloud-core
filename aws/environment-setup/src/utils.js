import 'dotenv/config.js'
import assert from 'assert'

import {ALERTS_TOPIC, CHILD_ACCOUNTS} from './runtime-envs.js'
import {defaultsForAwsService, assumeRoleTemporarily} from './auth-utils.js'

import {Athena} from '@aws-sdk/client-athena'
import {CloudFormation} from '@aws-sdk/client-cloudformation'
import {CloudWatchLogs} from '@aws-sdk/client-cloudwatch-logs'
import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import {DynamoDB} from '@aws-sdk/client-dynamodb'
import {IAM} from '@aws-sdk/client-iam'
import {IoT} from '@aws-sdk/client-iot'
import {S3} from '@aws-sdk/client-s3'
import {SNS} from '@aws-sdk/client-sns'

const alertsTopic = ALERTS_TOPIC //needs to be full arn
const childAccounts = CHILD_ACCOUNTS

const athena = new Athena(defaultsForAwsService('Athena'))
const sns = new SNS(defaultsForAwsService('SNS'))
const s3 = new S3(defaultsForAwsService('S3'))
const iam = new IAM(defaultsForAwsService('IAM'))
const iot = new IoT(defaultsForAwsService('IoT'))
const cloudWatchLogs = new CloudWatchLogs(defaultsForAwsService('CloudWatchLogs'))
const cloudformation = new CloudFormation(defaultsForAwsService('CloudFormation'))
const dynamoDb = new DynamoDB(defaultsForAwsService('DynamoDB'))
const dydbDocClient = DynamoDBDocument.from(dynamoDb)

export function assertNotPaging(response) {
	//haven't bothered to implement paging of responses, so just check that there isn't any paging required
	assert.strictEqual(response.NextToken, undefined, `Paging not currently supported.`) //docs say 'null' but library actually seems to be 'undefined'
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
	await sns.publish({
		Message: `${message}\n\ninvocationId=${invocationId}\n\n${getCurrentLambdaLogsLink()}`,
		TopicArn: alertsTopic,
		Subject: title
	})
	console.log('published sns alert')
}

function getCurrentLambdaLogsLink() {
	const {AWS_REGION, AWS_LAMBDA_LOG_GROUP_NAME, AWS_LAMBDA_LOG_STREAM_NAME} = process.env
	const encode = input => encodeURIComponent(encodeURIComponent(input)).replace(/%/g, '$')
	return `https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups/log-group/${encode(
		AWS_LAMBDA_LOG_GROUP_NAME
	)}/log-events/${encode(AWS_LAMBDA_LOG_STREAM_NAME)}`
}

export async function buildApiForAccount(accountId, role, api) {
	let clientConfigWithCreds = await assumeRoleTemporarily(`arn:aws:iam::${accountId}:role/${role}`)
	let cloudformation = new api(clientConfigWithCreds)
	return cloudformation
}

export {s3, iam, dydbDocClient, iot, cloudWatchLogs, athena, cloudformation}
