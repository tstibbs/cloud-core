import backOff from 'exponential-backoff'

import {cloudWatchLogs, buildSingleAccountLambdaHandler, publishNotification} from './utils.js'
import {USAGE_MONITOR_EVENT_AGE_DAYS, ATHENA_WORKGROUP_NAME} from './runtime-envs.js'
import {USAGE_TYPE_LOG_GROUP, USAGE_TYPE_CLOUDFRONT} from '../src/constants.js'
import {initialiseAthena, queryAthena} from './usage-utils.js'

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

function timeToAthenaFormattedDate(timeInSeconds) {
	let date = new Date(timeInSeconds * 1000)
	let month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
	let day = `${date.getUTCDate()}`.padStart(2, '0')
	return `${date.getUTCFullYear()}-${month}-${day}`
}

async function queryCloudfront(dates, stackName, stackResourceName, bucketName) {
	let startDate = timeToAthenaFormattedDate(dates.startTime)
	let endDate = timeToAthenaFormattedDate(dates.endTime)
	let tableName = `default.cloudfrontlogs_${stackName}_${stackResourceName}`
	//ensure the table exists
	await initialiseAthena(tableName, bucketName, stackName, stackResourceName, ATHENA_WORKGROUP_NAME)
	console.log('table created')
	let results = await queryAthena(tableName, startDate, endDate, ATHENA_WORKGROUP_NAME)
	let formattedResults = results.ResultSet.Rows.slice(1)
		.map(({Data}) => {
			let result = mapsToArray(Data)
			let [status, date, sourceIp, count] = result
			return `${stackName}/${stackResourceName} ${date} (${count}): HTTP ${status}, ${sourceIp}`
		})
		.join('\n')
	return formattedResults
}

function mapsToArray(arrayOfMaps) {
	return arrayOfMaps.map(map => Object.values(map).join(';'))
}

async function queryLogGroup(dates, stackName, stackResourceName, logGroup) {
	let {queryId} = await cloudWatchLogs
		.startQuery({
			queryString: QUERY,
			endTime: dates.endTime,
			startTime: dates.startTime,
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

async function processResources(invocationId, now, stacks) {
	now.setUTCHours(0)
	now.setUTCMinutes(0)
	now.setUTCSeconds(0)
	now.setUTCMilliseconds(0)
	let endTime = Math.round(now.getTime() / 1000) //the most recent occurance of UTC midnight
	let startTime = endTime - USAGE_MONITOR_EVENT_AGE_DAYS * 24 * 60 * 60
	let dates = {startTime, endTime}
	//
	let allResults = ''
	let errors = []
	for (let stack of stacks) {
		let stackName = stack.name
		for (let resource of stack.resources) {
			let result = ''
			switch (resource.type) {
				case USAGE_TYPE_CLOUDFRONT:
					result = await queryCloudfront(dates, stackName, resource.name, resource.source)
					break
				case USAGE_TYPE_LOG_GROUP:
					result = await queryLogGroup(dates, stackName, resource.name, resource.source)
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

async function queryStacks(invocationId) {
	//get all stack
	//query for specific output
	//decode
	let now = new Date()
	await processResources(invocationId, now, stacks)
}

export const handler = buildSingleAccountLambdaHandler(queryStacks)
export {processResources, queryCloudfront} //for simpler testing
