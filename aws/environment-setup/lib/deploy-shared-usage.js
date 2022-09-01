import {Duration, RemovalPolicy} from 'aws-cdk-lib'
import {CfnWorkGroup} from 'aws-cdk-lib/aws-athena'
import {ManagedPolicy, PolicyStatement} from 'aws-cdk-lib/aws-iam'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'
import {Bucket, BucketEncryption} from 'aws-cdk-lib/aws-s3'

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
			ATHENA_WORKGROUP_NAME: usageMonitorWorkGroup.name
		},
		initialPolicy: [
			new PolicyStatement({
				actions: ['athena:*', 'glue:*'],
				resources: ['*']
			})
		],
		memorySize: 128,
		timeout: Duration.minutes(5),
		runtime: Runtime.NODEJS_16_X
	})
	notificationTopic.grantPublish(usageMonitorFunction)
	usageMonitorFunction.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')) //to allow querying of abitrary buckets from other stacks
}

export {createUsageMonitor}
