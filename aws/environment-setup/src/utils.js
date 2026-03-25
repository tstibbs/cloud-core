import 'dotenv/config.js'
import assert from 'assert'

import {buildErrorNotifyingLambdaHandler} from '@tstibbs/cloud-core-utils/src/utils/lambda.js'
export {publishNotification} from '@tstibbs/cloud-core-utils/src/utils/lambda.js'

import {CHILD_ACCOUNTS} from './runtime-envs.js'
import {defaultsForAwsService, assumeRoleTemporarily} from './auth-utils.js'

import {Athena} from '@aws-sdk/client-athena'
import {CloudFormation} from '@aws-sdk/client-cloudformation'
import {CloudWatchLogs} from '@aws-sdk/client-cloudwatch-logs'
import {DynamoDBDocument} from '@aws-sdk/lib-dynamodb'
import {DynamoDB} from '@aws-sdk/client-dynamodb'
import {IAM} from '@aws-sdk/client-iam'
import {IoT} from '@aws-sdk/client-iot'
import {S3} from '@aws-sdk/client-s3'

const childAccounts = CHILD_ACCOUNTS

const athena = new Athena(defaultsForAwsService('Athena'))
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
	return buildErrorNotifyingLambdaHandler('tooling', async (event, context) => {
		return await delegate(context.awsRequestId)
	})
}

export async function buildApiForAccount(accountId, role, api) {
	let clientConfigWithCreds = await assumeRoleTemporarily(`arn:aws:iam::${accountId}:role/${role}`)
	let cloudformation = new api(clientConfigWithCreds)
	return cloudformation
}

export {s3, iam, dydbDocClient, iot, cloudWatchLogs, athena, cloudformation}
