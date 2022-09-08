import {Duration, RemovalPolicy} from 'aws-cdk-lib'
import {CfnWorkGroup} from 'aws-cdk-lib/aws-athena'
import {ManagedPolicy, PolicyStatement} from 'aws-cdk-lib/aws-iam'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'
import {Bucket, BucketEncryption} from 'aws-cdk-lib/aws-s3'
import {Rule, Schedule} from 'aws-cdk-lib/aws-events'
import {LambdaFunction as LambdaFunctionTarget} from 'aws-cdk-lib/aws-events-targets'

import {
	RAW_USAGE_MONITOR_EVENT_AGE_DAYS,
	RAW_USAGE_HIGH_RISK_COUNTRIES,
	RAW_USAGE_MY_COUNTRY_CODES,
	IP_INFO_TOKEN
} from './deploy-envs.js'

function createUsageMonitor(stack, notificationTopic) {
	const athenaResultsBucket = new Bucket(stack, 'athenaResultsBucket', {
		removalPolicy: RemovalPolicy.DESTROY,
		encryption: BucketEncryption.S3_MANAGED,
		autoDeleteObjects: true
	})

	const usageMonitorWorkGroup = new CfnWorkGroup(stack, 'usageMonitorWorkGroup', {
		name: 'usageMonitor',
		workGroupConfiguration: {
			resultConfiguration: {
				encryptionConfiguration: {
					encryptionOption: 'SSE_S3'
				},
				outputLocation: athenaResultsBucket.s3UrlForObject('athena')
			}
		}
	})

	const usageMonitorFunction = new NodejsFunction(stack, 'usageMonitorFunction', {
		entry: 'src/usage-monitor.js',
		environment: {
			ALERTS_TOPIC: notificationTopic.topicArn,
			ATHENA_WORKGROUP_NAME: usageMonitorWorkGroup.name,
			USAGE_MONITOR_EVENT_AGE_DAYS: RAW_USAGE_MONITOR_EVENT_AGE_DAYS,
			USAGE_HIGH_RISK_COUNTRIES: RAW_USAGE_HIGH_RISK_COUNTRIES,
			USAGE_MY_COUNTRY_CODES: RAW_USAGE_MY_COUNTRY_CODES,
			IP_INFO_TOKEN: IP_INFO_TOKEN
		},
		initialPolicy: [
			new PolicyStatement({
				actions: ['athena:*', 'glue:*'],
				resources: ['*']
			})
		],
		memorySize: 512,
		timeout: Duration.minutes(5),
		runtime: Runtime.NODEJS_16_X
	})
	notificationTopic.grantPublish(usageMonitorFunction)
	athenaResultsBucket.grantReadWrite(usageMonitorFunction)
	usageMonitorFunction.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')) //to allow querying of abitrary buckets from other stacks
	usageMonitorFunction.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsReadOnlyAccess')) //to allow querying of abitrary log groups from other stacks
	usageMonitorFunction.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationReadOnlyAccess')) //need to query all stacks to get usage data source info

	new Rule(stack, 'uageMonitorSchedule', {
		schedule: Schedule.cron({weekDay: '1', hour: '2', minute: '0'}), // 2am every Monday morning
		targets: [
			new LambdaFunctionTarget(usageMonitorFunction, {
				retryAttempts: 1
			})
		]
	})
}

export {createUsageMonitor}
