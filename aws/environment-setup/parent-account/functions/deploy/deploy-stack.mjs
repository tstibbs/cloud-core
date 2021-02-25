import {deploy, loadEnvs, ifCmd} from '@tstibbs/cloud-core-utils'

const stackName = 'root-account-setup'
const templatePath = '../template.yml'
const capabilities = ['CAPABILITY_NAMED_IAM']
const artifacts = {
	'function-code': {
		file: './dist/function.zip',
		versionParameterToInject: 'CodeVersion'
	}
}
const parameters = loadEnvs({
	PARAM_CHILD_ACCOUNTS: 'ChildAccounts',
	PARAM_ORG_ID: 'OrganisationId',
	PARAM_PARENT_ACCOUNT_ID: 'ParentAccountId',
	PARAM_NOTIFICATION_EMAIL_ADDRESS: 'NotificationEmailAddress',
	IP_RANGES: 'ExpectedIpRanges',
	BUDGET: 'Budget'
})
const {cfServiceRole} = loadEnvs({
	CF_ROLE_ARN: 'cfServiceRole' //e.g. arn:aws:iam::123456789:role/role-name'
})
async function run() {
	deploy(stackName, templatePath, capabilities, cfServiceRole, artifacts, parameters)
}

await ifCmd(import.meta, run)
