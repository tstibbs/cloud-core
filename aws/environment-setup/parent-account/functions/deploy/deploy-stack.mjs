import {deploy, loadEnvs} from '@tstibbs/cloud-core-utils'

const stackName = 'root-account-setup'
const templatePath = '../template.yml'
const capabilities = ['CAPABILITY_NAMED_IAM']
const artifacts = {
	'login-monitor': {
		file: './dist/function.zip',
		versionParameterToInject: 'CodeVersionLoginMonitor'
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
deploy(stackName, templatePath, capabilities, cfServiceRole, artifacts, parameters)
