import util from 'util'
import _ from 'lodash'
import assert from 'assert'
import backOff from 'exponential-backoff'

import {publishNotification, buildCfnForAccount} from './utils.js'

const childAccounts = process.env.CHILD_ACCOUNTS.split(',')

const sleep = util.promisify(setTimeout)

const detectionFailed = 'DETECTION_FAILED'
const detectionComplete = 'DETECTION_COMPLETE'
const driftStatusUnknown = 'UNKNOWN'
const driftStatusUnchecked = 'NOT_CHECKED'
const driftStatusDrifted = 'DRIFTED'
const driftStatusInSync = 'IN_SYNC'

async function checkOneStack(cloudformation, stackName) {
	let detectResponse = await cloudformation
		.detectStackDrift({
			StackName: stackName
		})
		.promise()
	assertNotPaging(detectResponse)
	let detectionId = detectResponse.StackDriftDetectionId

	const backoffParams = {
		maxDelay: 60 * 1000, // 1 minute
		startingDelay: 10 * 1000 // 10 seconds
	}
	const checkForCompletion = async () => {
		let statusResponse = await cloudformation
			.describeStackDriftDetectionStatus({
				StackDriftDetectionId: detectionId
			})
			.promise()
		console.log(JSON.stringify(statusResponse, null, 2))
		assertNotPaging(statusResponse)
		let detectionStatus = statusResponse.DetectionStatus
		console.log(`${stackName}: ${detectionStatus}`)
		if (detectionStatus == detectionFailed || detectionStatus == detectionComplete) {
			return statusResponse
		} else {
			throw new Error(`Detection status: ${detectionStatus}`)
		}
	}

	let statusResponse = await backOff.backOff(checkForCompletion, backoffParams)
	let detectionStatus = statusResponse.DetectionStatus
	let driftStatus = null
	if (detectionStatus == detectionFailed) {
		driftStatus = detectionFailed // if the detection failed we don't really care about the drift status
	} else if (detectionStatus == detectionComplete) {
		driftStatus = statusResponse.StackDriftStatus
		if (statusResponse.StackDriftStatus == driftStatusDrifted) {
			//if 'drifted' then apply extra filtering because cloudformation drift detection is fundamentally broken (see https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/791)
			let resourceDrifts = await cloudformation
				.describeStackResourceDrifts({
					StackName: stackName,
					StackResourceDriftStatusFilters: ['MODIFIED']
				})
				.promise()
			console.log(JSON.stringify(resourceDrifts, null, 2))
			assertNotPaging(resourceDrifts)
			//if the only diffs are APIs and the only diffs are empty bodies, then ignore
			let diffsAreAcceptable = resourceDrifts.StackResourceDrifts.every(
				drift =>
					drift.ResourceType == 'AWS::ApiGatewayV2::Api' &&
					drift.PropertyDifferences.every(diff => diff.PropertyPath == '/Body' && diff.ActualValue == 'null')
			)
			if (diffsAreAcceptable) {
				driftStatus = driftStatusInSync
			}
		}
	} else {
		assert.fail('should never happen') //because the call to backOff should have thrown an error
	}

	return {
		stackName,
		driftStatus
	}
}

async function checkOneAccount(accountId) {
	let cloudformation = await buildCfnForAccount(accountId)
	let stackResponse = await cloudformation.listStacks({}).promise()
	let stacks = stackResponse.StackSummaries.filter(summary => !/^DELETE.*/.test(summary.StackStatus)).map(
		summary => summary.StackName
	)
	console.log(`Checking drift status for: ${accountId} / ${stacks}`)
	assertNotPaging(stackResponse)

	let data = await inSeries(stacks, async stack => await checkOneStack(cloudformation, stack))
	let failures = data.filter(result => result.driftStatus == detectionFailed)
	data = data.filter(result => result.driftStatus != detectionFailed)
	if (failures.length > 0) {
		console.log(`Retrying: ${accountId} / ${stacks}`)
		await sleep(30 * 1000) // most common cause of failure is rate exceeded, so try again with a smaller set
		let data2 = await inSeries(failures, async failure => await checkOneStack(cloudformation, failure.stackName))
		data = [...data, ...data2]
	}
	data.forEach(result => (result.stackName = `${accountId}/${result.stackName}`))
	return data
}

async function inSeries(things, executor) {
	//run in series not in parallel to avoid the rate limiting kicking in
	let all = []
	for (let thing of things) {
		let data = await executor(thing)
		all.push(data)
	}
	return all
}

export async function handleEvent(event, context) {
	let invocationId = context.awsRequestId
	try {
		await runAllChecks(invocationId)
	} catch (e) {
		console.error(e)
		console.log('publishing sns alert for error')
		let message = 'Error occured checking for drift: \n' + e.stack + '\n' + JSON.stringify(e.originalError, null, 2)
		await publishNotification(message, 'AWS account cloud-formation alert', invocationId)
	}
}

export async function runAllChecks(invocationId) {
	console.log(`invocationId=${invocationId}`) //just to make it easy to match up an email and a log entry

	let allAcountsData = await inSeries(childAccounts, async childAccount => await checkOneAccount(childAccount))

	let data = {
		//set some defaults to simplify processing
		[driftStatusInSync]: [],
		[driftStatusDrifted]: [],
		[driftStatusUnknown]: [],
		[driftStatusUnchecked]: [],
		[detectionFailed]: [],
		[undefined]: [],
		[null]: []
	}
	allAcountsData.reduce(
		(data, oneAccountsData) =>
			oneAccountsData.reduce((all, stack) => {
				all[stack.driftStatus] = [...(all[stack.driftStatus] || []), stack.stackName]
				return all
			}, data),
		data
	)
	let printableData = JSON.stringify(data, null, 2)
	console.log(printableData)

	let invalidStacks = [
		...data[driftStatusUnknown],
		...data[driftStatusUnchecked],
		...data[detectionFailed],
		...data[undefined],
		...data[null]
	]
	let driftedStacks = data[driftStatusDrifted]
	delete data[driftStatusInSync]
	delete data[driftStatusDrifted]
	delete data[driftStatusUnknown]
	delete data[driftStatusUnchecked]
	delete data[detectionFailed]
	delete data[undefined]
	delete data[null]
	invalidStacks = invalidStacks.concat.apply(invalidStacks, Object.values(data))
	if (invalidStacks.length > 0) {
		console.log('publishing sns alert for error')
		let message = `Some stacks are in an invalid state:\n${invalidStacks.join(', ')}\n\nall data:\n${printableData}`
		await publishNotification(message, 'AWS account cloud-formation alert', invocationId)
	} else if (driftedStacks.length > 0) {
		console.log('publishing sns alert for drifting')
		let message = `Some stacks have drifted:\n${driftedStacks.join('\n')}\n\nall data:\n${printableData}}`
		await publishNotification(message, 'AWS account cloud-formation alert', invocationId)
	} else {
		//presumably the rest are all "IN_SYNC"
		console.log('not publishing alert')
	}
}

function assertNotPaging(response) {
	//haven't bothered to implement paging of responses, so just check that there isn't any paging required
	assert.ok(response.NextToken == undefined) //docs say 'null' but library actually seems to be 'undefined'
}

export const handler = handleEvent
