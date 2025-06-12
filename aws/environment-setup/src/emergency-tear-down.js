import {strictEqual as assertEqual} from 'assert'
import backOff from 'exponential-backoff'

import {cloudformation} from './utils.js'
import {publishNotification, buildSingleAccountLambdaHandler} from './utils.js'

async function destroyStacks(invocationId) {
	//get list of stacks
	let listResult = await cloudformation.describeStacks()
	let fetchTpPromises = listResult.Stacks.map(stack => getTpEnabled(stack.StackName))
	let tpResults = await Promise.all(fetchTpPromises)
	let tpEnabled = []
	let tpDisabled = []
	tpResults.forEach(stack => {
		if (stack.tpEnabled === true || stack.stackName === 'CDKToolkit') {
			tpEnabled.push(stack.stackName)
		} else {
			tpDisabled.push(stack)
		}
	})
	console.log(
		`Not attempting to destroy the following due to termination protection being enabled: ${tpEnabled.join(',')}`
	)
	//attempt to destroy any stacks that don't have termination protection enabled
	let stackDestroyRequests = tpDisabled.map(stack => destroyOneStack(stack))
	let results = await Promise.allSettled(stackDestroyRequests)
	//report on what happened
	let failures = {}
	let successes = []
	results.forEach((result, i) => {
		let {stackName} = tpDisabled[i]
		if (result.status == 'rejected') {
			failures[stackName] = `promise rejected -> ${result.reason}`
		} else if (result.value != 'DELETE_COMPLETE') {
			failures[stackName] = result.value
		} else {
			successes.push(stackName)
		}
	})
	await sendResults(invocationId, tpEnabled, successes, failures)
}

async function getTpEnabled(stackName) {
	let listResult = await cloudformation.describeStacks({
		StackName: stackName
	})

	assertEqual(listResult.Stacks.length, 1)
	return {
		stackName,
		stackId: listResult.Stacks[0].StackId,
		tpEnabled: listResult.Stacks[0].EnableTerminationProtection
	}
}

async function destroyOneStack(stack) {
	let requestResult = await cloudformation.deleteStack({
		StackName: stack.stackName
	})

	let initialStatus = requestResult.status
	if (initialStatus == 'rejected') {
		return 'request rejected'
	} else {
		//keep checking the status of the stack until the status is something other than the initial status or DELETE_IN_PROGRESS
		const backoffParams = {
			maxDelay: 60 * 1000, // 1 minute
			startingDelay: 10 * 1000 // 10 seconds
		}
		const checkForCompletion = async () => {
			let describeResult = await cloudformation.describeStacks({
				StackName: stack.stackId
			})

			let status = describeResult.Stacks[0].StackStatus
			console.log(`${stack.stackName}/${stack.stackId}: ${status}`)
			if (status == initialStatus || status == 'DELETE_IN_PROGRESS') {
				throw new Error(`Detection status: ${detectionStatus}`) //throw error to keep the backoff retrying
			} else {
				return status //status has changed from initial state, and it isn't delete_in_progress, so assume we've reached and end state.
			}
		}
		let eventualStatus = await backOff.backOff(checkForCompletion, backoffParams)
		return eventualStatus
	}
}

async function sendResults(invocationId, tpEnabled, successes, failures) {
	console.log('publishing sns alert for error')
	let message = `Attempted to destroy some stacks:
Skipped because they had termination protection enabled (${tpEnabled.length}): ${tpEnabled.join(', ')}
Successfully destroyed (${successes.length}): ${successes.join(', ')}
Failed to  destroy (${Object.entries(failures).length}): ${JSON.stringify(failures)}`
	console.log(message)
	await publishNotification(message, 'AWS Emergency Tear Down', invocationId)
}

export const handler = buildSingleAccountLambdaHandler(destroyStacks)
