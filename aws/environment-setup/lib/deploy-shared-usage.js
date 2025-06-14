import {Duration, RemovalPolicy} from 'aws-cdk-lib'
import {CfnWorkGroup} from 'aws-cdk-lib/aws-athena'
import {ManagedPolicy, PolicyStatement, Role, PolicyDocument, ArnPrincipal} from 'aws-cdk-lib/aws-iam'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'
import {Bucket, BucketEncryption} from 'aws-cdk-lib/aws-s3'
import {Rule, Schedule} from 'aws-cdk-lib/aws-events'
import {LambdaFunction as LambdaFunctionTarget} from 'aws-cdk-lib/aws-events-targets'

import {createMultiAccountLambdaRole} from './deploy-utils.js'
import {INFRA_ATHENA_WORKGROUP_NAME, USAGE_CHILD_ROLE_NAME, USAGE_PARENT_ROLE_NAME} from '../src/constants.js'
import {PARENT_ACCOUNT_ID, RAW_CHILD_ACCOUNTS} from './deploy-envs.js'

import {
	RAW_USAGE_MONITOR_EVENT_AGE_DAYS,
	RAW_USAGE_HIGH_RISK_COUNTRIES,
	RAW_USAGE_MY_COUNTRY_CODES,
	IP_INFO_TOKEN
} from './deploy-envs.js'

export function createSharedUsageMonitorResources(stack) {
	const athenaResultsBucket = new Bucket(stack, 'athenaResultsBucket', {
		removalPolicy: RemovalPolicy.DESTROY,
		encryption: BucketEncryption.S3_MANAGED,
		autoDeleteObjects: true
	})

	new CfnWorkGroup(stack, 'infraMonitoringWorkGroup', {
		name: INFRA_ATHENA_WORKGROUP_NAME, //this is referenced by name in other stacks
		workGroupConfiguration: {
			resultConfiguration: {
				encryptionConfiguration: {
					encryptionOption: 'SSE_S3'
				},
				outputLocation: athenaResultsBucket.s3UrlForObject('athena')
			}
		}
	})

	const childAccountUsageMonitorRole = new Role(stack, `childAccountUsageMonitorRole`, {
		//Note that if the parent account core stack is dropped and recreated, these trust relationships will have to be recreated too (see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html / IAM roles / Important)
		roleName: USAGE_CHILD_ROLE_NAME,
		assumedBy: new ArnPrincipal(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/${USAGE_PARENT_ROLE_NAME}`),
		inlinePolicies: {
			delegatingPolicy: new PolicyDocument({
				statements: [
					new PolicyStatement({
						actions: ['athena:*', 'glue:*'],
						resources: ['*']
					})
				]
			})
		}
	})
	childAccountUsageMonitorRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')) //to allow querying of abitrary buckets from other stacks
	childAccountUsageMonitorRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsReadOnlyAccess')) //to allow querying of abitrary log groups from other stacks
	childAccountUsageMonitorRole.addManagedPolicy(
		ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationReadOnlyAccess')
	) //need to query all stacks to get usage data source info
	athenaResultsBucket.grantReadWrite(childAccountUsageMonitorRole)
}

export function createParentUsageMonitorResources(stack, notificationTopic) {
	const lambdaRole = createMultiAccountLambdaRole(stack, USAGE_PARENT_ROLE_NAME, USAGE_CHILD_ROLE_NAME)
	const usageMonitorFunction = new NodejsFunction(stack, 'usageMonitorFunction', {
		entry: 'src/usage-monitor.js',
		environment: {
			ALERTS_TOPIC: notificationTopic.topicArn,
			USAGE_MONITOR_EVENT_AGE_DAYS: RAW_USAGE_MONITOR_EVENT_AGE_DAYS,
			USAGE_HIGH_RISK_COUNTRIES: RAW_USAGE_HIGH_RISK_COUNTRIES,
			USAGE_MY_COUNTRY_CODES: RAW_USAGE_MY_COUNTRY_CODES,
			IP_INFO_TOKEN: IP_INFO_TOKEN,
			CHILD_ACCOUNTS: RAW_CHILD_ACCOUNTS
		},

		role: lambdaRole,
		memorySize: 512,
		timeout: Duration.minutes(5),
		runtime: Runtime.NODEJS_22_X
	})
	notificationTopic.grantPublish(usageMonitorFunction)

	new Rule(stack, 'uageMonitorSchedule', {
		schedule: Schedule.cron({weekDay: '2', hour: '2', minute: '0'}), // 2am every Monday morning
		targets: [
			new LambdaFunctionTarget(usageMonitorFunction, {
				retryAttempts: 1
			})
		]
	})
}
