import assert from 'assert'

import backOff from 'exponential-backoff'

import {assertNotPaging} from './utils.js'

const QUERY_COMPLETE = 'Complete'
//note the 'tolower' is simply to convert the date as millis to as a string to prevent it being put into exponential format
const QUERY = `fields @timestamp, @message
| parse @message "*,* *,*" as @sourceIp, @method, @path
| filter @method != 'CONNECTION_API'
| stats count(*) as count by @sourceIp as sourceIp, @method as method, @path as path, tolower(datefloor(@timestamp, 1d)) as date`

/* if the endTime of the query is before the group creation time, or if retention settings 
mean it will have nothing in, then it will error. Check here so we can return zero results 
instead of trying to make an invalid query and then trying to catch the error. */
async function isQueryInTimeRange(cloudWatchLogs, endTime, logGroupName) {
	let endTimeInMillis = endTime * 1000
	let result = await cloudWatchLogs.describeLogGroups({
		logGroupNamePrefix: logGroupName
	})

	assertNotPaging(result)
	assert.strictEqual(result.logGroups.length, 1, `Expected exactly a single log group with this name`)
	let logGroup = result.logGroups[0]
	let creationTimeInMillis = logGroup.creationTime
	let {retentionInDays} = logGroup
	//check creation time
	let sinceCreation = endTimeInMillis >= creationTimeInMillis
	//check retention
	const oldestRetainedEntry = new Date()
	oldestRetainedEntry.setUTCDate(oldestRetainedEntry.getUTCDate() - retentionInDays)
	let sinceRetention = endTimeInMillis >= oldestRetainedEntry.getTime()
	return sinceCreation && sinceRetention
}

export async function fetchLogEntries(cloudWatchLogs, dates, logGroup) {
	if ((await isQueryInTimeRange(cloudWatchLogs, dates.endTime, logGroup)) == false) {
		return []
	} else {
		let {queryId} = await cloudWatchLogs.startQuery({
			queryString: QUERY,
			endTime: dates.endTime,
			startTime: dates.startTime,
			logGroupName: logGroup
		})

		//keep checking the status of the query until it's completed
		const backoffParams = {
			maxDelay: 60 * 1000, // 1 minute
			startingDelay: 2 * 1000 // 2 seconds
		}
		const checkForCompletion = async () => {
			let queryResponse = await cloudWatchLogs.getQueryResults({
				queryId: queryId
			})

			if (queryResponse.status != QUERY_COMPLETE) {
				throw new Error(`status=${queryResponse.status}`) // throwing error causes backoff to retry, though if not 'running' or 'scheduled' then it's unlikely to change
			} else {
				return queryResponse.results
			}
		}
		let results = await backOff.backOff(checkForCompletion, backoffParams)
		return results
	}
}
