import {Stack, CfnOutput, RemovalPolicy} from 'aws-cdk-lib'
import {Role, CompositePrincipal, ServicePrincipal, ArnPrincipal, ManagedPolicy} from 'aws-cdk-lib/aws-iam'
import {Bucket, BucketEncryption} from 'aws-cdk-lib/aws-s3'

import {applyStandardTags} from '@tstibbs/cloud-core-utils'
import {
	apiGatewayCloudwatchRoleRef,
	applicationLogsBucketRef
} from '@tstibbs/cloud-core-utils/src/stacks/usage-tracking.js'

import {buildDeveloperPolicy, buildCloudFormationInvokerPolicy, buildScoutSuitePolicy} from './deploy-shared-roles.js'
import {createEmergencyInfra} from './deploy-shared-infra.js'
import {PARENT_ACCOUNT_ID} from './deploy-envs.js'
import {PARENT_ACCNT_CLI_ROLE_NAME, buildNotificationChannels} from './deploy-shared.js'

class AllAccountsStack extends Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		const notificationTopic = buildNotificationChannels(this)
		createCliRoles(this)
		createScoutSuiteElements(this)
		createEmergencyInfra(this, notificationTopic)
		createApplicationDependencies(this)
		applyStandardTags(this)
	}
}

function createCliRoles(stack) {
	let developerPolicy = buildDeveloperPolicy(stack)
	let cloudFormationInvokerPolicy = buildCloudFormationInvokerPolicy(stack)
	new Role(stack, 'parentAccountCliRole', {
		roleName: PARENT_ACCNT_CLI_ROLE_NAME,
		assumedBy: new CompositePrincipal(
			new ServicePrincipal('cloudformation.amazonaws.com', {
				assumeRoleAction: 'sts:AssumeRole'
			}),
			//Note that if the parent account core stack is dropped and recreated, these trust relationships will have to be recreated too (see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html / IAM roles / Important)
			new ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:user/AllAccountCliEntryUser`),
			new ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/toolingFunctionsRole`)
		),
		managedPolicies: [developerPolicy, cloudFormationInvokerPolicy]
	})
}

function createScoutSuiteElements(stack) {
	let scoutSuitePolicy = buildScoutSuitePolicy(stack)
	new Role(stack, 'scoutSuiteRole', {
		roleName: 'ScoutSuiteRole',
		//Note that if the parent account core stack is dropped and recreated, this trust relationship will have to be recreated too (see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html / IAM roles / Important)
		assumedBy: new ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:user/AllAccountCliEntryUser`),
		managedPolicies: [scoutSuitePolicy]
	})
}

function createApplicationDependencies(stack) {
	//create a role for use by api gateway logging - create it once here because otherwise it'll get removed when we remove the stack that created it
	const apiGatewayCloudWatchRole = new Role(stack, 'apiGatewayCloudWatchRole', {
		assumedBy: new ServicePrincipal('apigateway.amazonaws.com', {
			assumeRoleAction: 'sts:AssumeRole'
		}),
		managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName(`service-role/AmazonAPIGatewayPushToCloudWatchLogs`)]
	})
	const applicationLogsBucket = new Bucket(stack, 'applicationLogsBucket', {
		encryption: BucketEncryption.S3_MANAGED,
		removalPolicy: RemovalPolicy.DESTROY,
		autoDeleteObjects: true
	})
	new CfnOutput(stack, 'apiGatewayCloudWatchRoleArn', {
		value: apiGatewayCloudWatchRole.roleArn,
		exportName: apiGatewayCloudwatchRoleRef
	})
	new CfnOutput(stack, 'applicationLogsBucketArn', {
		value: applicationLogsBucket.bucketArn,
		exportName: applicationLogsBucketRef
	})
}

export {AllAccountsStack}
