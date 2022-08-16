import backOff from 'exponential-backoff'

import {cloudWatchLogs, buildSingleAccountLambdaHandler, publishNotification} from './utils.js'
import {USAGE_MONITOR_EVENT_AGE_DAYS} from './runtime-envs.js'
import {USAGE_TYPE_LOG_GROUP, USAGE_TYPE_BUCKET} from '../src/constants.js'

const QUERY_COMPLETE = 'Complete'
const QUERY = `fields @timestamp, @message
| parse @message "*,* *,*" as @sourceIp, @method, @path
| stats count(*) as count by @sourceIp as sourceIp, @method as method, @path as path, datefloor(@timestamp, 1d) as date`

function fieldsArrayToMap(fields) {
	return fields.reduce((all, entry) => {
		all[entry.field] = entry.value
		return all
	}, {})
}

async function queryLogGroup(stackName, stackResourceName, logGroup) {
	let now = new Date()
	now.setUTCHours(0)
	now.setUTCMinutes(0)
	now.setUTCSeconds(0)
	now.setUTCMilliseconds(0)
	let endTime = Math.round(now.getTime() / 1000) //the most recent occurance of UTC midnight
	let startTime = endTime - USAGE_MONITOR_EVENT_AGE_DAYS * 24 * 60 * 60

	let {queryId} = await cloudWatchLogs
		.startQuery({
			queryString: QUERY,
			endTime: endTime,
			startTime: startTime,
			logGroupName: logGroup
		})
		.promise()

	//keep checking the status of the query until it's completed
	const backoffParams = {
		maxDelay: 60 * 1000, // 1 minute
		startingDelay: 2 * 1000 // 2 seconds
	}
	const checkForCompletion = async () => {
		let queryResponse = await cloudWatchLogs
			.getQueryResults({
				queryId: queryId
			})
			.promise()
		if (queryResponse.status != QUERY_COMPLETE) {
			throw new Error(`status=${queryResponse.status}`) // throwing error causes backoff to retry, though if not 'running' or 'scheduled' then it's unlikely to change
		} else {
			return queryResponse.results
		}
	}
	let results = await backOff.backOff(checkForCompletion, backoffParams)
	return results
		.map(fieldsArray => {
			let result = fieldsArrayToMap(fieldsArray)
			let {date, count, sourceIp, method, path} = result
			return `${stackName}/${stackResourceName} ${date} (${count}): ${method} ${path}, ${sourceIp}`
		})
		.join('\n')
}

async function processResources(invocationId, stacks) {
	let allResults = ''
	let errors = []
	for (let stack of stacks) {
		let stackName = stack.name
		for (let resource of stack.resources) {
			let result = ''
			switch (resource.type) {
				case USAGE_TYPE_LOG_GROUP:
					result = await queryLogGroup(stackName, resource.name, resource.source)
					break
				default:
					errors.push(resource)
			}
			allResults += '\n' + result
		}
	}
	if (errors.length > 0) {
		allResults += '\nerrors: ' + JSON.stringify(errors, null, 2)
	}
	console.log(`publishing sns alert:\n${allResults}`)
	await publishNotification(
		`Usage info for the past USAGE_MONITOR_EVENT_AGE_DAYS days:\n\n${allResults}`,
		'AWS usage info',
		invocationId
	)
}

export {processResources}
