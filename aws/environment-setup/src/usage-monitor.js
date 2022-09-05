import {buildSingleAccountLambdaHandler, publishNotification} from './utils.js'
import {USAGE_MONITOR_EVENT_AGE_DAYS, ATHENA_WORKGROUP_NAME} from './runtime-envs.js'
import {initialiseAthena, queryAthena} from './usage-utils-athena.js'
import {fetchLogEntries} from './usage-utils-logs.js'
import {cloudformation} from './utils.js'
import {
	OUTPUT_PREFIX,
	USAGE_TYPE_LOG_GROUP,
	USAGE_TYPE_CLOUDFRONT
} from '@tstibbs/cloud-core-utils/src/stacks/usage-tracking.js'

function fieldsArrayToMap(fields) {
	return fields.reduce((all, entry) => {
		all[entry.field] = entry.value
		return all
	}, {})
}

function timeToAthenaFormattedDate(timeInSeconds) {
	return millisToFormattedDate(timeInSeconds * 1000)
}

function millisToFormattedDate(timeInMillis) {
	let date = new Date(timeInMillis)
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
	let parsedResults = results.ResultSet.Rows.slice(1).map(({Data}) => {
		let result = mapsToArray(Data)
		let [status, date, sourceIp, method, count] = result
		let event = `${method} ${status}`
		return {
			stackName,
			stackResourceName,
			date,
			count,
			event,
			sourceIp
		}
	})
	return parsedResults
}

function mapsToArray(arrayOfMaps) {
	return arrayOfMaps.map(map => Object.values(map).join(';'))
}

async function queryLogGroup(dates, stackName, stackResourceName, logGroup) {
	//supports any HTTP, WebSocket or REST API that has been configured with the log group settings from aws/utils/src/stacks/usage-tracking.js
	let results = await fetchLogEntries(dates, logGroup)
	return results.map(fieldsArray => {
		let result = fieldsArrayToMap(fieldsArray)
		let {date, count, sourceIp, method, path} = result
		date = millisToFormattedDate(parseInt(date))
		let event = `${method} ${path}`
		return {
			stackName,
			stackResourceName,
			date,
			count,
			event,
			sourceIp
		}
	})
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
	let allResults = []
	let errors = []
	for (let stack of stacks) {
		let stackName = stack.name
		for (let resource of stack.resources) {
			let results = ''
			switch (resource.type) {
				case USAGE_TYPE_CLOUDFRONT:
					results = await queryCloudfront(dates, stackName, resource.name, resource.source)
					break
				case USAGE_TYPE_LOG_GROUP:
					results = await queryLogGroup(dates, stackName, resource.name, resource.source)
					break
				default:
					errors.push(resource)
			}
			allResults = allResults.concat(results)
		}
	}
	if (errors.length > 0) {
		allResults.push('errors: ' + JSON.stringify(errors, null, 2))
	}
	if (allResults.length == 0) {
		allResults.push('No usage found.')
	}
	let resultsText = allResults
		.map(
			result =>
				`${result.stackName}/${result.stackResourceName} ${result.date} (${result.count}): ${result.event}, ${result.sourceIp}`
		)
		.join('\n')
	console.log(`publishing sns alert:\n${resultsText}`)
	await publishNotification(
		`Usage info for the past ${USAGE_MONITOR_EVENT_AGE_DAYS} days:\n\n${resultsText}`,
		'AWS usage info',
		invocationId
	)
}

async function queryStacks(invocationId) {
	//get outputs from stacks
	let listResult = await cloudformation.describeStacks().promise()
	let stacks = listResult.Stacks.map(stack => {
		let resources = stack.Outputs.filter(output => output.OutputKey.startsWith(OUTPUT_PREFIX)).map(output =>
			JSON.parse(output.OutputValue)
		)
		return {
			name: stack.StackName,
			resources
		}
	}).filter(stack => stack.resources.length > 0)
	console.log(JSON.stringify(stacks, null, 2))
	const now = new Date()
	await processResources(invocationId, now, stacks)
}

export const handler = buildSingleAccountLambdaHandler(queryStacks)
export {processResources, queryCloudfront} //for simpler testing
