/* This function duplicates some features of AWS Config - however AWS Config is expensive for reporting on just these items. */

import {parse as csvParse} from 'csv-parse/sync'
import backOff from 'exponential-backoff'
import {IAMClient, GenerateCredentialReportCommand, GetCredentialReportCommand} from '@aws-sdk/client-iam'

import {MAX_CREDENTIAL_AGE} from './runtime-envs.js'
import {buildApiForAccount, buildMultiAccountLambdaHandler} from './utils.js'
import {MonitorStore} from './monitor-store.js'

const dayInMillis = 24 * 60 * 60 * 1000
const monitorType = 'iam-checker'

const monitorStore = new MonitorStore(monitorType, 'IAM', formatIssues, addIssuePks)

async function checkOneAccount(accountId) {
	const issues = []
	const now = Date.now()
	const maxCredentialAge = MAX_CREDENTIAL_AGE //in days
	const iam = await buildApiForAccount(accountId, 'ParentAccountCliRole', IAMClient)

	async function runChecks() {
		await doWithBackoff(new GenerateCredentialReportCommand())
		let response = await doWithBackoff(new GetCredentialReportCommand())
		let csv = response.Content.toString()
		const data = csvParse(csv, {
			columns: true
		})
		console.log(data)
		let rootUsers = data.filter(entry => entry.user == '<root_account>')
		let nonRootUsers = data.filter(entry => entry.user != '<root_account>')
		if (rootUsers.length <= 0) {
			assert('rootUsers', 'length', '> 0', rootUsers.length)
		}
		if (rootUsers.length + nonRootUsers.length != data.length) {
			assert('all users', 'count', 'data.length', rootUsers.length + nonRootUsers.length)
		}

		// Check root user doesn't have any access keys
		noRootAccessKeys(rootUsers)
		// Check root user has MFA enabled
		rootMfaEnabled(rootUsers)
		// check MFA enabled for all users with console access
		consoleUsersMfaEnabled(nonRootUsers)
		// Check no access keys older than x days
		checkCredentials(nonRootUsers)
	}

	function assert(resource, attribute, expected, actual) {
		if (expected !== actual) {
			issues.push({accountId, resource, attribute, expected, actual})
		}
	}

	function noRootAccessKeys(rootUsers) {
		rootUsers.forEach(user => {
			assert(user.arn, 'access_key_1_active', 'false', user.access_key_1_active)
			assert(user.arn, 'access_key_2_active', 'false', user.access_key_2_active)
		})
	}

	function rootMfaEnabled(rootUsers) {
		rootUsers.forEach(user => assert(user.arn, 'mfa_active', 'true', user.mfa_active))
	}

	function consoleUsersMfaEnabled(nonRootUsers) {
		nonRootUsers
			.filter(user => user.password_enabled === 'true')
			.forEach(user => assert(user.arn, 'mfa_active', 'true', user.mfa_active))
	}

	function checkCredentials(nonRootUsers) {
		nonRootUsers.forEach(user => {
			if (user.password_enabled === 'true') {
				dateMoreRecentThan(user, 'password_last_changed', maxCredentialAge)
			}
			if (user.access_key_1_active === 'true') {
				dateMoreRecentThan(user, 'access_key_1_last_rotated', maxCredentialAge)
			}
			if (user.access_key_2_active === 'true') {
				dateMoreRecentThan(user, 'access_key_2_last_rotated', maxCredentialAge)
			}
		})
	}

	function dateMoreRecentThan(user, attribute, maxDiff) {
		let date = new Date(user[attribute]).getTime()
		let diff = Math.round((now - date) / dayInMillis)
		if (isNaN(diff) || diff >= maxDiff) {
			assert(user.arn, attribute, `less than ${maxDiff} days ago`, diff)
		}
	}

	async function doWithBackoff(command) {
		const backoffParams = {
			maxDelay: 65 * 1000, // 1 minute, 5 seconds
			startingDelay: 4 * 1000 // 10 seconds
		}
		//if not ready, `iam.getCredentialReport()` will throw an error with a 'ReportInProgress' code which will cause the backoff to happen anyway
		const runDelegate = async () => {
			try {
				return await iam.send(command)
			} catch (e) {
				console.error(`error making retryable call for ${command.serialize.name}`)
				console.error(e)
				throw e
			}
		}
		let result = null
		try {
			result = await backOff.backOff(() => {
				return runDelegate()
			}, backoffParams)
		} catch (e) {
			console.error(`error calling backoff for ${command.serialize.name}`)
			console.error(e)
			throw e
		}
		return result
	}

	await runChecks()
	return issues
}

function formatIssues(issues) {
	return issues.map(
		issue =>
			`${issue.accountId}: ${issue.resource}.${issue.attribute} should be '${issue.expected}' but was '${issue.actual}'`
	)
}

function addIssuePks(issues) {
	issues.forEach(issue => (issue.pk = `${issue.accountId}-${issue.resource}-${issue.attribute}-${issue.expected}`))
}

async function summarise(invocationId, allAcountsData) {
	let allIssues = allAcountsData.flat()
	console.log('resolving issues across all accounts')
	await monitorStore.summariseAndNotify(invocationId, allIssues)
}

export const handler = buildMultiAccountLambdaHandler(checkOneAccount, summarise)
