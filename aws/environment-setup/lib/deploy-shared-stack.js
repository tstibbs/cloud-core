import cdk from '@aws-cdk/core'
import iam from '@aws-cdk/aws-iam'
import {buildDeveloperPolicy, buildCloudFormationInvokerPolicy, buildScoutSuitePolicy} from './deploy-shared-roles.js'
import {PARENT_ACCOUNT_ID} from './deploy-envs.js'
import {PARENT_ACCNT_CLI_ROLE_NAME} from './deploy-shared.js'

class AllAccountsStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		createCliRoles(this)
		createScoutSuiteElements(this)
	}
}

function createCliRoles(stack) {
	let developerPolicy = buildDeveloperPolicy(stack)
	let cloudFormationInvokerPolicy = buildCloudFormationInvokerPolicy(stack)
	new iam.Role(stack, 'parentAccountCliRole', {
		roleName: PARENT_ACCNT_CLI_ROLE_NAME,
		assumedBy: new iam.CompositePrincipal(
			new iam.ServicePrincipal('cloudformation.amazonaws.com', {
				assumeRoleAction: 'sts:AssumeRole'
			}),
			//Note that if the parent account core stack is dropped and recreated, these trust relationships will have to be recreated too (see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html / IAM roles / Important)
			new iam.ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:user/AllAccountCliEntryUser`),
			new iam.ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/toolingFunctionsRole`)
		),
		managedPolicies: [developerPolicy, cloudFormationInvokerPolicy]
	})
}

function createScoutSuiteElements(stack) {
	let scoutSuitePolicy = buildScoutSuitePolicy(stack)
	new iam.Role(stack, 'scoutSuiteRole', {
		roleName: 'ScoutSuiteRole',
		//Note that if the parent account core stack is dropped and recreated, this trust relationship will have to be recreated too (see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html / IAM roles / Important)
		assumedBy: new iam.ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:user/AllAccountCliEntryUser`),
		managedPolicies: [scoutSuitePolicy]
	})
}

export {AllAccountsStack}
