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
		let sunday = new Date().getDay() === 0
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
		if (sunday) {
			return currentIssues
		} else {
			return unreportedIssues
		}
	}

	async summariseAndNotify(invocationId, issues) {
		console.log(`${issues.length} issues found: ${JSON.stringify(issues, null, 2)}`)
		this._addIssuePks(issues)
		let unreportedIssues = await this._resolveIssues(issues)
		if (unreportedIssues.length == 0) {
			console.log(`all ${issues.length} issues previously reported`)
		} else {
			console.log(`${unreportedIssues.length}/${issues.length} issues not previously reported`)
			let message = `${this._monitorLabel} issues found:\n\n` + this._formatIssues(issues).join('\n')
			await publishNotification(message, `AWS account ${this._monitorLabel} alert`, invocationId)
		}
	}
}
