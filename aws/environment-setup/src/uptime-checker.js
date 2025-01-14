import lodash from 'lodash'
const {pick} = lodash

import {iot, buildSingleAccountLambdaHandler} from './utils.js'
import {MonitorStore} from './monitor-store.js'

const uptimeThingGroup = 'uptime-monitoring'
const monitorType = 'uptime-checker'
const indexName = 'AWS_Things'
const monitorStore = new MonitorStore(monitorType, 'uptime', formatIssues, addIssuePks)

async function runChecks(invocationId) {
	let params = {
		queryString: 'connectivity.connected:false',
		indexName: indexName
	}
	let results = await iot.searchIndex(params)
	let issues = results.things
		.filter(
			thing =>
				//this would be better done in the search query but there doesn't seem to be a way to query by group membership
				thing.thingGroupNames !== undefined &&
				thing.thingGroupNames !== null &&
				thing.thingGroupNames.includes(uptimeThingGroup)
		)
		.map(thing => pick(thing, ['connectivity', 'thingId', 'thingName']))
	await monitorStore.summariseAndNotify(invocationId, issues)
}

function formatIssues(issues) {
	return issues.map(issue => {
		let timestamp = issue.connectivity.timestamp != null ? new Date(issue.connectivity.timestamp) : '[unknown]'
		return `${issue.thingName} (${issue.thingId}) was disconnected since ${timestamp}'`
	})
}

function addIssuePks(issues) {
	issues.forEach(issue => (issue.pk = issue.thingName))
}

export const handler = buildSingleAccountLambdaHandler(runChecks)
