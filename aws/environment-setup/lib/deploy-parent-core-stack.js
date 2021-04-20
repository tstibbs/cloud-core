import cdk from '@aws-cdk/core'
import iam from '@aws-cdk/aws-iam'

import {CHILD_ACCOUNTS} from './deploy-envs.js'
const childAccounts = CHILD_ACCOUNTS.split(',')
import {PARENT_ACCNT_CLI_ROLE_NAME} from './deploy-shared.js'

class ParentAccountCoreStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		this.createConsoleUser(this)
		this.createCliUser(this)
	}

	createConsoleUser(scope) {
		let thisAccountAdminPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
		let allAccountAdminPolicy = new iam.ManagedPolicy(scope, 'allAccountAdminPolicy', {
			description: 'Gives admin permissions on each child account.',
			statements: [
				new iam.PolicyStatement({
					actions: ['sts:AssumeRole'],
					resources: childAccounts.map(account => `arn:aws:iam::${account}:role/OrganizationAccountAccessRole`)
				})
			]
		})

		let allAccountAdminGroup = new iam.Group(scope, 'allAccountAdminGroup', {
			managedPolicies: [thisAccountAdminPolicy, allAccountAdminPolicy]
		})

		let allAccountAdminUser = new iam.User(scope, 'allAccountAdminUser', {
			userName: 'AllAccountAdminUser'
		})
		allAccountAdminUser.addToGroup(allAccountAdminGroup)
	}

	createCliUser(scope) {
		let allAccountCliEntryPolicy = new iam.ManagedPolicy(scope, 'allAccountCliEntryPolicy', {
			description: 'Allows user to assume admin roles in child accounts.',
			statements: [
				// admin permissions on each child account
				new iam.PolicyStatement({
					actions: ['sts:AssumeRole'],
					resources: childAccounts.map(account => `arn:aws:iam::${account}:role/${PARENT_ACCNT_CLI_ROLE_NAME}`)
				}),
				// scout-suite checking permissions on each child account
				new iam.PolicyStatement({
					actions: ['sts:AssumeRole'],
					resources: childAccounts.map(account => `arn:aws:iam::${account}:role/ScoutSuiteRole`)
				})
			]
		})

		let allAccountCliEntryGroup = new iam.Group(scope, 'allAccountCliEntryGroup', {
			managedPolicies: [allAccountCliEntryPolicy]
		})

		let allAccountCliEntryUser = new iam.User(scope, 'allAccountCliEntryUser', {
			userName: 'AllAccountCliEntryUser'
		})
		allAccountCliEntryUser.addToGroup(allAccountCliEntryGroup)
	}
}

export {ParentAccountCoreStack}
