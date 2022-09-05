import backOff from 'exponential-backoff'

import {cloudWatchLogs} from './utils.js'

const QUERY_COMPLETE = 'Complete'
const QUERY = `fields @timestamp, @message
| parse @message "*,* *,*" as @sourceIp, @method, @path
| stats count(*) as count by @sourceIp as sourceIp, @method as method, @path as path, datefloor(@timestamp, 1d) as date`

export async function fetchLogEntries(dates, logGroup) {
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
}
