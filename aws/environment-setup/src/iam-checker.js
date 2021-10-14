import {buildApiForAccount, publishNotification, buildHandler} from './utils.js'
import csvParse from 'csv-parse/lib/sync.js'
import backOff from 'exponential-backoff'

const dayInMillis = 24 * 60 * 60 * 1000

async function checkOneAccount(accountId) {
	const issues = []
	const now = Date.now()
	const maxCredentialAge = process.env.MAX_CREDENTIAL_AGE //in days
	const maxUnusedCredentialDays = process.env.MAX_UNUSED_CREDENTIAL_DAYS //in days
	const iam = await buildApiForAccount(accountId, 'IAM')

	async function runChecks() {
		await iam.generateCredentialReport().promise()
		let response = await getCredentialReport()
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
		// Check no access keys older than x days and no credentials that have been unused for x days
		checkCredentials(nonRootUsers)
	}

	function assert(resource, attribute, expected, actual) {
		if (expected !== actual) {
			issues.push(`${accountId}: ${resource}.${attribute} should be '${expected}' but was '${actual}'`)
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
				dateMoreRecentThan(user, 'password_last_used', maxUnusedCredentialDays)
				dateMoreRecentThan(user, 'password_last_changed', maxCredentialAge)
			}
			if (user.access_key_1_active === 'true') {
				dateMoreRecentThan(user, 'access_key_1_last_used_date', maxUnusedCredentialDays)
				dateMoreRecentThan(user, 'access_key_1_last_rotated', maxCredentialAge)
			}
			if (user.access_key_2_active === 'true') {
				dateMoreRecentThan(user, 'access_key_2_last_used_date', maxUnusedCredentialDays)
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

	async function getCredentialReport() {
		const backoffParams = {
			maxDelay: 60 * 1000, // 1 minute
			startingDelay: 10 * 1000 // 10 seconds
		}
		//if not ready, `iam.getCredentialReport()` will throw an error with a 'ReportInProgress' code which will cause the backoff to happen anyway
		let credentialReport = await backOff.backOff(() => iam.getCredentialReport().promise(), backoffParams)
		return credentialReport
	}

	await runChecks()
	return issues
}

async function summarise(invocationId, allAcountsData) {
	let allIssues = allAcountsData.flat()
	console.log(`allIssues: ${JSON.stringify(allIssues, null, 2)}`)
	if (allIssues.length == 0) {
		console.log(`No issues found across any accounts.`)
	} else {
		console.log('Some issues found')
		let message = `IAM issues found:\n\n` + allIssues.join('\n')
		await publishNotification(message, 'AWS account iam alert', invocationId)
	}
}

export const handler = buildHandler(checkOneAccount, summarise)
