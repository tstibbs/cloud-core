import cdk from '@aws-cdk/core'
import s3 from '@aws-cdk/aws-s3'
import iam from '@aws-cdk/aws-iam'
import config from '@aws-cdk/aws-config'
import eventsTargets from '@aws-cdk/aws-events-targets'
import events from '@aws-cdk/aws-events'
import {PARENT_ACCNT_CLI_ROLE_NAME} from './deploy-shared.js'

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
			resourceTypes: ['AWS::IAM::User', 'AWS::CloudFormation::Stack']
		}
	})
	configurationRecorder.addDependsOn(configServiceRole)

	new config.CfnDeliveryChannel(scope, 'deliveryChannel', {
		s3BucketName: configBucket.bucketName,
		configSnapshotDeliveryProperties: {
			deliveryFrequency: 'TwentyFour_Hours'
		}
	})

	return configurationRecorder
}

function buildConfigRules(scope, configurationRecorder) {
	let rules = [
		//iam
		new config.ManagedRule(scope, 'ruleIamRootAccessKeyCheck', {
			identifier: config.ManagedRuleIdentifiers.IAM_ROOT_ACCESS_KEY_CHECK
		}),
		new config.ManagedRule(scope, 'ruleRootAccountMfaEnabled', {
			identifier: config.ManagedRuleIdentifiers.ROOT_ACCOUNT_MFA_ENABLED
		}),
		new config.ManagedRule(scope, 'ruleMfaEnabledForIamConsoleAccess', {
			identifier: config.ManagedRuleIdentifiers.MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS
		}),
		new config.ManagedRule(scope, 'ruleAccessKeysRotated', {
			identifier: config.ManagedRuleIdentifiers.ACCESS_KEYS_ROTATED,
			inputParameters: {
				maxAccessKeyAge: 2
			}
		}),
		new config.ManagedRule(scope, 'ruleIamUserUnusedCredentialsCheck', {
			identifier: config.ManagedRuleIdentifiers.IAM_USER_UNUSED_CREDENTIALS_CHECK,
			inputParameters: {
				maxCredentialUsageAge: 2
			}
		}),
		//cloudformation
		new config.ManagedRule(scope, 'cloudformationStackDriftDetectionCheck', {
			identifier: config.ManagedRuleIdentifiers.CLOUDFORMATION_STACK_DRIFT_DETECTION_CHECK,
			inputParameters: {
				cloudformationRoleArn: `arn:aws:iam::${scope.account}:user/${PARENT_ACCNT_CLI_ROLE_NAME}` //TODO not sure how this will work when we change to track resources accross the organisation?
			}
		})
	]
	rules.forEach(rule => rule.node.addDependency(configurationRecorder))
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
	let configurationRecorder = buildConfigPlatform(scope)
	buildConfigRules(scope, configurationRecorder)
	buildNotificationRules(scope, notificationTopic)
}
