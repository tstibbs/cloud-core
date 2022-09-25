import util from 'util'
import _ from 'lodash'
import assert from 'assert'
import backOff from 'exponential-backoff'

import {buildApiForAccount, assertNotPaging, inSeries, buildMultiAccountLambdaHandler} from './utils.js'
import {diffsAreAcceptable} from './drift-exclusions.js'
import {MonitorStore} from './monitor-store.js'

const sleep = util.promisify(setTimeout)

const detectionFailed = 'DETECTION_FAILED'
const detectionComplete = 'DETECTION_COMPLETE'
const driftStatusDrifted = 'DRIFTED'
const driftStatusInSync = 'IN_SYNC'

const monitorStore = new MonitorStore('cfn-drift-checker', 'CFN-DRIFT', formatIssues, addIssuePks)

function formatIssues(issues) {
	return issues.map(issue => `${issue.accountId}: ${issue.stackName} is '${issue.driftStatus}'`)
}

function addIssuePks(issues) {
	issues.forEach(issue => (issue.pk = `${issue.accountId}-${issue.stackName}`))
}

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
			if (diffsAreAcceptable(resourceDrifts.StackResourceDrifts)) {
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

function deletedStacksFilter(summary) {
	//explicitly list states, we don't want to accidentally ignore a new state should one get added in the future
	const ignoredStates = [
		'ROLLBACK_COMPLETE', //Successful removal of one or more stacks after a failed stack creation or after an explicitly canceled stack creation.
		'ROLLBACK_FAILED', //Unsuccessful removal of one or more stacks after a failed stack creation or after an explicitly canceled stack creation.
		'ROLLBACK_IN_PROGRESS', //Ongoing removal of one or more stacks after a failed stack creation or after an explicitly canceled stack creation.
		'CREATE_IN_PROGRESS',
		'CREATE_FAILED',
		'DELETE_COMPLETE',
		'DELETE_FAILED',
		'DELETE_IN_PROGRESS'
	]
	return !ignoredStates.includes(summary.StackStatus)
}

async function checkOneAccount(accountId) {
	let cloudformation = await buildApiForAccount(accountId, 'ParentAccountCliRole', 'CloudFormation')
	let stackResponse = await cloudformation.listStacks({}).promise()
	let stacks = stackResponse.StackSummaries.filter(deletedStacksFilter).map(summary => summary.StackName)
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
	data.forEach(result => (result.accountId = accountId))
	return data
}

async function summarise(invocationId, allAcountsData) {
	let allIssues = allAcountsData.flat()
	let inSync = allIssues.filter(issue => issue.driftStatus === driftStatusInSync).map(issue => issue.stackName)
	let drifted = allIssues.filter(issue => issue.driftStatus !== driftStatusInSync)
	console.log(['Stacks in sync: ', ...inSync].join('\n'))
	console.log('resolving issues across all accounts')
	await monitorStore.summariseAndNotify(invocationId, drifted)
}

export const handler = buildMultiAccountLambdaHandler(checkOneAccount, summarise)
