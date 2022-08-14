import {strictEqual as assertEqual} from 'assert'

import {aws} from './auth-utils.js'
import {publishNotification, buildSingleAccountLambdaHandler} from './utils.js'

const cloudformation = new aws.CloudFormation()

async function destroyStacks(invocationId) {
	//get list of stacks
	let listResult = await cloudformation.describeStacks().promise()
	let fetchTpPromises = listResult.Stacks.map(stack => getTpEnabled(stack.StackName))
	let tpResults = await Promise.all(fetchTpPromises)
	let tpEnabled = []
	let tpDisabled = []
	tpResults.forEach(stack => {
		if (stack.tpEnabled === true || stack.stackName === 'CDKToolkit') {
			tpEnabled.push(stack.stackName)
		} else {
			tpDisabled.push(stack.stackName)
		}
	})
	console.log(
		`Not attempting to destroy the following due to termination protection being enabled: ${tpEnabled.join(',')}`
	)
	//attempt to destroy any stacks that don't have termination protection enabled
	let stackDestroyRequests = tpDisabled.map(name => destroyOneStack(name))
	//TODO wait for them to be actually destroyed?
	let results = await Promise.allSettled(stackDestroyRequests)
	//report on what happened
	let failures = {}
	let successes = []
	results.forEach((result, i) => {
		let stackName = tpDisabled[i]
		if (result.status == 'rejected') {
			failures[stackName] = result.reason
		} else {
			successes.push(stackName)
		}
	})
	await sendResults(invocationId, tpEnabled, successes, failures)
}

async function getTpEnabled(stackName) {
	let listResult = await cloudformation
		.describeStacks({
			StackName: stackName
		})
		.promise()
	assertEqual(listResult.Stacks.length, 1)
	return {
		stackName,
		tpEnabled: listResult.Stacks[0].EnableTerminationProtection
	}
}

async function destroyOneStack(stackName) {
	await cloudformation
		.deleteStack({
			StackName: stackName
		})
		.promise()
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
