import cdk from '@aws-cdk/core'
import iam from '@aws-cdk/aws-iam'
import {
	buildDevApiLimitedPolicies,
	buildCloudFormationInvokerPolicy,
	buildCloudFormationInvokerLimitedPolicy,
	buildScoutSuitePolicy
} from './deploy-shared-roles.js'
import {PARENT_ACCOUNT_ID} from './deploy-envs.js'
import {PARENT_ACCNT_CLI_ROLE_NAME} from './deploy-shared.js'

class AllAccountsStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		let devApiLimitedPolicies = buildDevApiLimitedPolicies(this)
		let cloudFormationInvokerPolicy = buildCloudFormationInvokerPolicy(this)
		createCliRoles(this, devApiLimitedPolicies, cloudFormationInvokerPolicy)
		createCloudformationElements(this, devApiLimitedPolicies, cloudFormationInvokerPolicy)
		createScoutSuiteElements(this)
	}
}

function createCliRoles(scope, devApiLimitedPolicies, cloudFormationInvokerPolicy) {
	let devApiIamPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('IAMFullAccess')

	new iam.Role(scope, 'parentAccountCliRole', {
		roleName: PARENT_ACCNT_CLI_ROLE_NAME,
		assumedBy: new iam.CompositePrincipal(
			new iam.ServicePrincipal('cloudformation.amazonaws.com', {
				assumeRoleAction: 'sts:AssumeRole'
			}),
			//Note that if the parent account core stack is dropped and recreated, these trust relationships will have to be recreated too (see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html / IAM roles / Important)
			new iam.ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:user/AllAccountCliEntryUser`),
			new iam.ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/toolingFunctionsRole`)
		),
		managedPolicies: [devApiIamPolicy, ...devApiLimitedPolicies, cloudFormationInvokerPolicy]
	})
}

function createCloudformationElements(scope, devApiLimitedPolicies, cloudFormationInvokerPolicy) {
	//it's important that this policy does not have write permissions to IAM
	let cloudFormationServiceRole = new iam.Role(scope, 'cloudFormationServiceRole', {
		roleName: 'CloudFormationServiceRole',
		assumedBy: new iam.ServicePrincipal('cloudformation.amazonaws.com', {
			assumeRoleAction: 'sts:AssumeRole'
		}),
		managedPolicies: devApiLimitedPolicies
	})

	let cloudFormationInvokerLimitedPolicy = buildCloudFormationInvokerLimitedPolicy(scope, cloudFormationServiceRole)
	let cloudFormationInvokerGroup = new iam.Group(scope, 'cloudFormationInvokerGroup', {
		managedPolicies: [cloudFormationInvokerPolicy, cloudFormationInvokerLimitedPolicy]
	})

	let cloudFormationInvokerUser = new iam.User(scope, 'cloudFormationInvokerUser', {
		userName: 'CloudFormationInvokerUser'
	})
	cloudFormationInvokerUser.addToGroup(cloudFormationInvokerGroup)
}

function createScoutSuiteElements(scope) {
	let scoutSuitePolicy = buildScoutSuitePolicy(scope)
	new iam.Role(scope, 'scoutSuiteRole', {
		roleName: 'ScoutSuiteRole',
		//Note that if the parent account core stack is dropped and recreated, this trust relationship will have to be recreated too (see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html / IAM roles / Important)
		assumedBy: new iam.ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:user/AllAccountCliEntryUser`),
		managedPolicies: [scoutSuitePolicy]
	})
}

export {AllAccountsStack}
