import {buildMultiAccountLambdaHandler, publishNotification, buildApiForAccount} from './utils.js'
import {USAGE_MONITOR_EVENT_AGE_DAYS, ATHENA_WORKGROUP_NAME} from './runtime-envs.js'
import {
	initialiseAthena_CloudFront,
	queryAthena_CloudFront,
	initialiseAthena_S3AccessLogs,
	queryAthena_S3AccessLogs
} from './usage-utils-athena.js'
import {fetchLogEntries} from './usage-utils-logs.js'
import {USAGE_CHILD_ROLE_NAME} from './constants.js'
import {getIpInfo} from './ip-info.js'
import {
	OUTPUT_PREFIX,
	USAGE_TYPE_LOG_GROUP,
	USAGE_TYPE_CLOUDFRONT,
	USAGE_TYPE_S3_ACCESS_LOGS
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

async function queryCloudfront(apis, accountId, dates, stackName, resource) {
	const {name: stackResourceName, source: bucketName} = resource
	const {athena} = apis
	let startDate = timeToAthenaFormattedDate(dates.startTime)
	let endDate = timeToAthenaFormattedDate(dates.endTime)
	let tableName = `cloudfrontlogs_${stackName}_${stackResourceName}`
	//ensure the table exists
	await initialiseAthena_CloudFront(athena, tableName, bucketName, stackName, stackResourceName, ATHENA_WORKGROUP_NAME)
	console.log('table created')
	let results = await queryAthena_CloudFront(athena, tableName, startDate, endDate, ATHENA_WORKGROUP_NAME)
	let parsedResults = results.ResultSet.Rows.slice(1).map(({Data}) => {
		let result = mapsToArray(Data)
		let [count, status, date, sourceIp, method, geoBlocked, uriRoot] = result
		let event = `${method} ${status}`
		let values = {
			accountId,
			stackName,
			stackResourceName,
			date,
			count,
			event,
			sourceIp,
			geoBlocked
		}
		if (resource.splitReportingByUrlRoot) {
			values.uriRoot = uriRoot
		}
		return values
	})
	return parsedResults
}

async function queryS3AccessLogs(apis, accountId, dates, stackName, resource) {
	const {name: stackResourceName, source: bucketName} = resource
	const {athena} = apis
	let startDate = timeToAthenaFormattedDate(dates.startTime)
	let endDate = timeToAthenaFormattedDate(dates.endTime)
	let tableName = `s3accesslogs_${stackName}_${stackResourceName}`
	//ensure the table exists
	await initialiseAthena_S3AccessLogs(
		athena,
		tableName,
		bucketName,
		stackName,
		stackResourceName,
		ATHENA_WORKGROUP_NAME
	)
	console.log('table created')
	let results = await queryAthena_S3AccessLogs(athena, tableName, startDate, endDate, ATHENA_WORKGROUP_NAME)
	let parsedResults = results.ResultSet.Rows.slice(1).map(({Data}) => {
		let result = mapsToArray(Data)
		let [count, status, date, sourceIp, method] = result
		let event = `${method} ${status}`
		return {
			accountId,
			stackName,
			stackResourceName,
			date,
			count,
			event,
			sourceIp,
			geoBlocked: false
		}
	})
	return parsedResults
}

function mapsToArray(arrayOfMaps) {
	return arrayOfMaps.map(map => Object.values(map).join(';'))
}

async function queryLogGroup(apis, accountId, dates, stackName, resource) {
	const {name: stackResourceName, source: logGroup} = resource
	const {cloudWatchLogs} = apis
	//supports any HTTP, WebSocket or REST API that has been configured with the log group settings from aws/utils/src/stacks/usage-tracking.js
	let results = await fetchLogEntries(cloudWatchLogs, dates, logGroup)
	return results.map(fieldsArray => {
		let result = fieldsArrayToMap(fieldsArray)
		let {date, count, sourceIp, method, path} = result
		date = millisToFormattedDate(parseInt(date))
		let event = `${method} ${path}`
		return {
			accountId,
			stackName,
			stackResourceName,
			date,
			count,
			event,
			sourceIp
		}
	})
}

async function processResources(accountId, now, stacks, apis) {
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
			let results = []
			switch (resource.type) {
				case USAGE_TYPE_CLOUDFRONT:
					results = await queryCloudfront(apis, accountId, dates, stackName, resource)
					break
				case USAGE_TYPE_S3_ACCESS_LOGS:
					results = await queryS3AccessLogs(apis, accountId, dates, stackName, resource)
					break
				case USAGE_TYPE_LOG_GROUP:
					results = await queryLogGroup(apis, accountId, dates, stackName, resource)
					break
				default:
					errors.push(resource)
			}
			allResults = allResults.concat(results)
		}
	}
	return {
		results: allResults,
		errors
	}
}

function formatResults(resultsFormatter, allResults, ipInfo, errors) {
	//prepare report
	let formattedResults = []
	//add IP information
	let formattedIps = Object.entries(ipInfo)
		.map(([ip, {description, risk}]) => `${ip}: ${description} (${risk} risk)`)
		.sort()
	if (formattedIps.length > 0) {
		formattedResults = formattedResults.concat(formattedIps, '') //empty string to add a newline
	}
	formattedResults.push(resultsFormatter(allResults, ipInfo))
	//deal with error cases
	if (errors.length > 0) {
		formattedResults.push('') //empty string to add a newline
		formattedResults.push('errors: ' + JSON.stringify(errors, null, 2))
	}
	if (allResults.length == 0) {
		formattedResults.push('No usage found.')
	}
	//send report
	let resultsText = `Usage info for the past ${USAGE_MONITOR_EVENT_AGE_DAYS} days:\n\n${formattedResults.join('\n')}`
	return resultsText
}

function formatResultsForLog(allResults, ipInfo) {
	let formattedResults = allResults
		.map(result => {
			let blockString = ''
			if (result.geoBlocked) {
				blockString = `, ${result.geoBlocked}`
			}
			return `${result.accountId}/${result.stackName}/${result.stackResourceName} ${result.date} (${result.count}): ${result.event}, ${result.sourceIp} (${result.risk} ip risk${blockString})`
		})
		.join('\n')
	return formattedResults
}

function formatResultsForEmail(allResults, ipInfo) {
	const createTitle = result => {
		let prefix = `${result.accountId} / ${result.stackName} / ${result.stackResourceName}`
		if (result.uriRoot != null) {
			prefix = `${prefix} / ${result.uriRoot}`
		}
		return prefix
	}
	const uniques = (arr, extractor) => [...new Set(arr.map(extractor))].sort()
	let stackDisplays = uniques(allResults, createTitle)
	let stackSummaries = stackDisplays
		.map(stackDisplay => {
			let stackResults = allResults.filter(result => stackDisplay == createTitle(result))
			let ipsToCount = stackResults.reduce((ipsToCount, stackResult) => {
				let {count, sourceIp, geoBlocked} = stackResult
				let ipDescriptor = sourceIp
				if (sourceIp in ipInfo) {
					let {shortDescription, risk} = ipInfo[sourceIp]
					risk = `${risk} risk`
					if (geoBlocked) {
						risk = `${risk} (${geoBlocked})`
					}
					let descriptionRegex = /^([^\(]+\()AS\d+ (.+\))$/
					let regexMatch = shortDescription.match(descriptionRegex)
					if (regexMatch != null) {
						shortDescription = `${regexMatch[1]}${regexMatch[2]}`
					}
					ipDescriptor = `${risk}: ${shortDescription}`
				}
				if (!(ipDescriptor in ipsToCount)) {
					ipsToCount[ipDescriptor] = 0
				}
				ipsToCount[ipDescriptor] += parseInt(count)
				return ipsToCount
			}, {})
			let summaries = Object.entries(ipsToCount)
				.map(([ip, count]) => `${ip}: ${count}`)
				.sort()
				.join('\n')
			let summary = `${stackDisplay}\n${summaries}`
			return summary
		})
		.join('\n\n')
	return stackSummaries
}

async function checkOneAccount(accountId) {
	const cloudformation = await buildApiForAccount(accountId, USAGE_CHILD_ROLE_NAME, 'CloudFormation')
	const athena = await buildApiForAccount(accountId, USAGE_CHILD_ROLE_NAME, 'Athena')
	const cloudWatchLogs = await buildApiForAccount(accountId, USAGE_CHILD_ROLE_NAME, 'CloudWatchLogs')
	const apis = {
		athena,
		cloudWatchLogs
	}
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
	return await processResources(accountId, now, stacks, apis)
}

async function summariseAccounts(invocationId, allAcountsData) {
	let allResults = allAcountsData.map(output => output.results).flat()
	let allErrors = allAcountsData.map(output => output.errors).flat()
	//add IP information
	let ips = allResults.map(result => result.sourceIp)
	let ipInfo = await getIpInfo(ips)
	allResults.forEach(result => {
		let ip = result.sourceIp
		if (ip in ipInfo) {
			result.risk = ipInfo[ip].risk
		} else {
			result.risk = 'unknown'
		}
	})
	//simpler report for email, more detail for the log
	let logReport = formatResults(formatResultsForLog, allResults, ipInfo, allErrors)
	let emailReport = formatResults(formatResultsForEmail, allResults, ipInfo, allErrors)
	console.log(`publishing sns alert:\n\`\`\`\n${emailReport}\n\`\`\`\n\n`)
	console.log(`detailed report:\n\`\`\`\n${logReport}\n\`\`\`\n\n`)
	await publishNotification(emailReport, 'AWS usage info', invocationId)
}

export const handler = buildMultiAccountLambdaHandler(checkOneAccount, summariseAccounts)
