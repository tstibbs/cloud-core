import cdk from '@aws-cdk/core'
import s3 from '@aws-cdk/aws-s3'
import iam from '@aws-cdk/aws-iam'
import config from '@aws-cdk/aws-config'
import eventsTargets from '@aws-cdk/aws-events-targets'
import events from '@aws-cdk/aws-events'
const {EventField, Rule, RuleTargetInput} = events

function buildConfigPlatform(scope) {
	const configBucket = new s3.Bucket(scope, 'configBucket', {
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
	configBucket.addToResourcePolicy(
		new iam.PolicyStatement({
			actions: ['s3:GetBucketAcl'],
			principals: [new iam.ServicePrincipal('config.amazonaws.com')],
			resources: [configBucket.bucketArn]
		})
	)
	configBucket.addToResourcePolicy(
		new iam.PolicyStatement({
			actions: ['s3:PutObject'],
			principals: [new iam.ServicePrincipal('config.amazonaws.com')],
			resources: [configBucket.arnForObjects(`AWSLogs/${scope.account}/Config/*`)],
			conditions: {
				StringEquals: {
					's3:x-amz-acl': 'bucket-owner-full-control'
				}
			}
		})
	)

	let configServiceRole = new iam.CfnServiceLinkedRole(scope, 'configServiceRole', {
		awsServiceName: 'config.amazonaws.com'
	})

	let configurationRecorder = new config.CfnConfigurationRecorder(scope, 'configurationRecorder', {
		roleArn: `arn:aws:iam::${scope.account}:role/aws-service-role/config.amazonaws.com/AWSServiceRoleForConfig`,
		recordingGroup: {
			resourceTypes: ['AWS::IAM::User']
		}
	})
	configurationRecorder.addDependsOn(configServiceRole)

	new config.CfnDeliveryChannel(scope, 'deliveryChannel', {
		s3BucketName: configBucket.bucketName,
		configSnapshotDeliveryProperties: {
			deliveryFrequency: 'TwentyFour_Hours'
		}
	})
}

function buildConfigRules(scope) {
	new config.ManagedRule(scope, 'ruleIamRootAccessKeyCheck', {
		identifier: 'IAM_ROOT_ACCESS_KEY_CHECK'
	})

	new config.ManagedRule(scope, 'ruleRootAccountMfaEnabled', {
		identifier: 'ROOT_ACCOUNT_MFA_ENABLED'
	})

	new config.ManagedRule(scope, 'ruleMfaEnabledForIamConsoleAccess', {
		identifier: 'MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS'
	})

	new config.ManagedRule(scope, 'ruleAccessKeysRotated', {
		identifier: 'ACCESS_KEYS_ROTATED',
		inputParameters: {
			maxAccessKeyAge: 2
		}
	})

	new config.ManagedRule(scope, 'ruleIamUserUnusedCredentialsCheck', {
		identifier: 'IAM_USER_UNUSED_CREDENTIALS_CHECK',
		inputParameters: {
			maxCredentialUsageAge: 2
		}
	})
}

function buildNotificationRules(scope, notificationTopic) {
	let time = EventField.fromPath('$.detail.newEvaluationResult.resultRecordedTime')
	let rule = EventField.fromPath('$.detail.configRuleName')
	let resource = EventField.fromPath('$.detail.resourceId')
	let was = EventField.fromPath('$.detail.oldEvaluationResult.complianceType')
	let now = EventField.fromPath('$.detail.newEvaluationResult.complianceType')
	let accountId = EventField.fromPath('$.detail.awsAccountId')
	let region = EventField.fromPath('$.detail.awsRegion')
	let resourceType = EventField.fromPath('$.detail.resourceType')
	let resourceId = EventField.fromPath('$.detail.resourceId')
	let wholeEvent = EventField.fromPath('$')

	new Rule(scope, 'notificationEventRule', {
		eventPattern: {
			source: ['aws.config'],
			detailType: ['Config Rules Compliance Change']
		},
		targets: [
			new eventsTargets.SnsTopic(notificationTopic, {
				message: RuleTargetInput.fromMultilineText(
					`rule: ${rule}
was: ${was}
now: ${now}
in: (${accountId} / ${region})
resource: ${resource}
time: ${time}
see: https://console.aws.amazon.com/config/home?region=${region}#/timeline/${resourceType}/${resourceId}/configuration
event: ${wholeEvent}
`
				)
			})
		]
	})
}

export function buildAwsConfigStack(scope, notificationTopic) {
	buildConfigPlatform(scope)
	buildConfigRules(scope)
	buildNotificationRules(scope, notificationTopic)
}
