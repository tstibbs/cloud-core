import cdk from 'aws-cdk-lib'
import iam from 'aws-cdk-lib/aws-iam'

import {applyStandardTags} from '@tstibbs/cloud-core-utils'

import {CHILD_ACCOUNTS} from './deploy-envs.js'
import {PARENT_ACCNT_CLI_ROLE_NAME} from './deploy-shared.js'

class ParentAccountCoreStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		this.createConsoleUser(this)
		this.createCliUser(this)
		applyStandardTags(this)
	}

	createConsoleUser(stack) {
		let thisAccountAdminPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
		let allAccountAdminPolicy = new iam.ManagedPolicy(stack, 'allAccountAdminPolicy', {
			description: 'Gives admin permissions on each child account.',
			statements: [
				new iam.PolicyStatement({
					actions: ['sts:AssumeRole'],
					resources: CHILD_ACCOUNTS.map(account => `arn:aws:iam::${account}:role/OrganizationAccountAccessRole`)
				})
			]
		})

		let allAccountAdminGroup = new iam.Group(stack, 'allAccountAdminGroup', {
			managedPolicies: [thisAccountAdminPolicy, allAccountAdminPolicy]
		})

		let allAccountAdminUser = new iam.User(stack, 'allAccountAdminUser', {
			userName: 'AllAccountAdminUser'
		})
		allAccountAdminUser.addToGroup(allAccountAdminGroup)
	}

	createCliUser(stack) {
		let allAccountCliEntryPolicy = new iam.ManagedPolicy(stack, 'allAccountCliEntryPolicy', {
			description: 'Allows user to assume admin roles in child accounts.',
			statements: [
				// admin permissions on each child account
				new iam.PolicyStatement({
					actions: ['sts:AssumeRole'],
					resources: CHILD_ACCOUNTS.map(account => `arn:aws:iam::${account}:role/${PARENT_ACCNT_CLI_ROLE_NAME}`)
				}),
				// scout-suite checking permissions on each child account
				new iam.PolicyStatement({
					actions: ['sts:AssumeRole'],
					resources: CHILD_ACCOUNTS.map(account => `arn:aws:iam::${account}:role/ScoutSuiteRole`)
				})
			]
		})

		let allAccountCliEntryGroup = new iam.Group(stack, 'allAccountCliEntryGroup', {
			managedPolicies: [allAccountCliEntryPolicy]
		})

		let allAccountCliEntryUser = new iam.User(stack, 'allAccountCliEntryUser', {
			userName: 'AllAccountCliEntryUser'
		})
		allAccountCliEntryUser.addToGroup(allAccountCliEntryGroup)
	}
}

export {ParentAccountCoreStack}
