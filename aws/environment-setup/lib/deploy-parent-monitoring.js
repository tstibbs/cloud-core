import cdk from '@aws-cdk/core'
import s3 from '@aws-cdk/aws-s3'
import iam from '@aws-cdk/aws-iam'
import s3n from '@aws-cdk/aws-s3-notifications'
import nodejsLambda from '@aws-cdk/aws-lambda-nodejs'
import lambda from '@aws-cdk/aws-lambda'
import {IP_RANGES, PARENT_ACCOUNT_ID, ORG_ID} from './deploy-envs.js'

function createLambda(scope, notificationTopic, cloudTrailLogsBucket) {
	const loginMonitorFunction = new nodejsLambda.NodejsFunction(scope, 'loginMonitorFunction', {
		entry: 'src/loginChecker.js',
		environment: {
			IP_RANGES,
			ALERTS_TOPIC: notificationTopic.topicArn
		},
		memorySize: 128,
		timeout: cdk.Duration.seconds(20),
		runtime: lambda.Runtime.NODEJS_14_X
	})
	notificationTopic.grantPublish(loginMonitorFunction)
	cloudTrailLogsBucket.grantRead(loginMonitorFunction)
	cloudTrailLogsBucket.addEventNotification(
		s3.EventType.OBJECT_CREATED,
		new s3n.LambdaDestination(loginMonitorFunction)
	)
	return loginMonitorFunction
}

function setupCloudTrail(scope) {
	const cloudTrailLogsBucket = new s3.Bucket(scope, 'cloudTrailLogsBucket', {
		removalPolicy: cdk.RemovalPolicy.DESTROY,
		autoDeleteObjects: true,
		blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
		lifecycleRules: [
			{
				id: 'cleanup',
				abortIncompleteMultipartUploadAfter: cdk.Duration.days(2)
				//TODO also "Clean up expired object delete markers" not in cf yet - https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/132
			}
		]
	})

	cloudTrailLogsBucket.addToResourcePolicy(
		new iam.PolicyStatement({
			actions: ['s3:GetBucketAcl'],
			principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
			resources: [cloudTrailLogsBucket.bucketArn]
		})
	)
	//we don't actually expect to write anything to this path, but cloud trail checks for it, so it has to be there
	cloudTrailLogsBucket.addToResourcePolicy(
		new iam.PolicyStatement({
			actions: ['s3:PutObject'],
			principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
			resources: [cloudTrailLogsBucket.arnForObjects(`AWSLogs/${PARENT_ACCOUNT_ID}/*`)],
			conditions: {
				StringEquals: {
					's3:x-amz-acl': 'bucket-owner-full-control'
				}
			}
		})
	)
	cloudTrailLogsBucket.addToResourcePolicy(
		new iam.PolicyStatement({
			actions: ['s3:PutObject'],
			principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
			resources: [cloudTrailLogsBucket.arnForObjects(`AWSLogs/${ORG_ID}/*`)],
			conditions: {
				StringEquals: {
					's3:x-amz-acl': 'bucket-owner-full-control'
				}
			}
		})
	)
	return cloudTrailLogsBucket
}

export function buildAccountMonitoring(scope, notificationTopic) {
	let cloudTrailLogsBucket = setupCloudTrail(scope)
	createLambda(scope, notificationTopic, cloudTrailLogsBucket)
}
