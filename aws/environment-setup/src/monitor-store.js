import lodash from 'lodash'
const {difference} = lodash

import {dydbDocClient, publishNotification} from './utils.js'
import {MONITOR_TABLE_NAME} from './runtime-envs.js'
import {MONITOR_STORE_SCHEMA} from './constants.js'
const {PK, OBJ} = MONITOR_STORE_SCHEMA

export class MonitorStore {
	constructor(monitorType, monitorLabel, formatIssues, addIssuePks) {
		this._monitorTypePrefix = `${monitorType}--`
		this._monitorLabel = monitorLabel
		this._formatIssues = formatIssues
		this._addIssuePks = addIssuePks
	}

	async _getPreviousIssues() {
		let params = {
			TableName: MONITOR_TABLE_NAME,
			FilterExpression: `begins_with(#pkField, :monitorType)`,
			ExpressionAttributeNames: {
				'#pkField': PK.name
			},
			ExpressionAttributeValues: {
				':monitorType': this._monitorTypePrefix
			}
		}

		let data = await dydbDocClient.scan(params).promise()
		return data.Items.map(item => JSON.parse(item.obj))
	}

	async _updateStore(newIssues, obseletePks) {
		let putParams = newIssues.map(issue => ({
			PutRequest: {
				Item: {
					[PK.name]: `${this._monitorTypePrefix}${issue.pk}`,
					[OBJ.name]: JSON.stringify(issue)
				}
			}
		}))
		let deleteParams = obseletePks.map(pk => ({
			DeleteRequest: {
				Key: {
					[PK.name]: `${this._monitorTypePrefix}${pk}`
				}
			}
		}))
		let params = {
			RequestItems: {
				[MONITOR_TABLE_NAME]: [...putParams, ...deleteParams]
			}
		}

		await dydbDocClient.batchWrite(params).promise()
	}

	async _resolveIssues(currentIssues) {
		let previousIssues = await this._getPreviousIssues()
		let previousPks = previousIssues.map(issue => issue.pk)
		let currentPks = currentIssues.map(issue => issue.pk)
		//delete anything old and store anything new
		let obseletePks = difference(previousPks, currentPks)
		let newPks = difference(currentPks, previousPks)
		let unreportedIssues = currentIssues.filter(issue => newPks.includes(issue.pk))
		if (unreportedIssues.length > 0 || obseletePks.length > 0) {
			await this._updateStore(unreportedIssues, obseletePks)
		}
		let fixedIssues = previousIssues.filter(issue => obseletePks.includes(issue.pk))
		let previouslyReportedIssues = currentIssues.filter(issue => !newPks.includes(issue.pk))
		return {
			raised: unreportedIssues,
			existing: previouslyReportedIssues,
			fixed: fixedIssues,

		}
	}

	_formatIssuesForMessage(heading, issues) {
		if (issues.length > 0) {
			return `${heading}:\n\n` + this._formatIssues(issues).join('\n') + '\n\n'
		} else {
			return `No ${heading}.\n\n`
		}
	}

	async summariseAndNotify(invocationId, issues) {
		let sunday = new Date().getDay() === 0
		console.log(`${issues.length} issues found: ${JSON.stringify(issues, null, 2)}`)
		this._addIssuePks(issues)
		let {raised, existing, fixed} = await this._resolveIssues(issues)

		//if sunday, send if we have any issues at all
		//if not sunday, only send if we have raised or fixed issues

		if (raised.length > 0 || fixed.length > 0 || (existing.length > 0 && sunday)) {
			console.log({raised: raised.length, existing: existing.length, fixed: fixed.length})
			let message = `${this._monitorLabel} issues found.\n\n`
				+ this._formatIssuesForMessage('newly raised issues', raised)
				+ this._formatIssuesForMessage('previously raised issues', existing)
				+ this._formatIssuesForMessage('issues resolved', fixed)
			await publishNotification(message, `AWS account ${this._monitorLabel} alert`, invocationId)
		} else if (sunday) {
			console.log('no issues to report at all')
		} else {
			//issues is the list of issues we've found today (regardless of whether new or not)
			console.log(`all ${issues.length} issues previously reported`)
		}
	}
}
