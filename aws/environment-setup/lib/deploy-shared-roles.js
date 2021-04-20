import iam from '@aws-cdk/aws-iam'

/* This file just contains roles with lots of actions, to prevent the large text blocks making it hard to read the main stack file */

const eu12Condition = {
	StringEquals: {
		'aws:RequestedRegion': ['eu-west-1', 'eu-west-2']
	}
}

export function buildDevApiLimitedPolicy(scope) {
	return new iam.ManagedPolicy(scope, 'devApiLimitedPolicy', {
		description: `Sensible permissive policy for a developer but which _doesn't_ allow access to IAM.`,
		statements: [
			new iam.PolicyStatement({
				//allow certain approved services, but only on specific approved regions
				actions: [
					'apigateway:*',
					'athena:*',
					'cloudformation:*',
					'cloudwatch:*',
					'dax:*',
					'dynamodb:*',
					'events:*',
					'kinesis:*',
					'kms:*',
					'lambda:*',
					'logs:*',
					's3:*',
					'ses:*',
					'sns:*',
					'sqs:*',
					'ssm:*'
				],
				resources: ['*'],
				conditions: eu12Condition
			}),
			new iam.PolicyStatement({
				actions: [
					// the following four services are special cases which use a single 'global' (i.e. us-based) endpoint
					'cloudfront:*',
					'route53:*',
					'support:*',
					//only iam read access here
					'iam:GetGroup',
					'iam:GetGroupPolicy',
					'iam:GetPolicy',
					'iam:GetPolicyVersion',
					'iam:GetRole',
					'iam:GetRolePolicy',
					'iam:GetUser',
					'iam:GetUserPolicy',
					'iam:ListAttachedGroupPolicies',
					'iam:ListAttachedRolePolicies',
					'iam:ListAttachedUserPolicies',
					'iam:ListEntitiesForPolicy',
					'iam:ListGroupPolicies',
					'iam:ListGroups',
					'iam:ListGroupsForUser',
					'iam:ListPolicies',
					'iam:ListPoliciesGrantingServiceAccess',
					'iam:ListPolicyVersions',
					'iam:ListRolePolicies',
					'iam:ListRoleTags',
					'iam:ListRoles',
					'iam:ListUserPolicies',
					'iam:ListUserTags',
					'iam:ListUsers'
				],
				resources: ['*']
			})
		]
	})
}

export function buildCloudFormationInvokerPolicy(scope) {
	return new iam.ManagedPolicy(scope, 'cloudFormationInvokerPolicy', {
		description: 'Gives permission to assume roles required for CDK.',
		statements: [
			new iam.PolicyStatement({
				//can assume the various CDK roles
				actions: ['sts:AssumeRole'],
				resources: [
					`arn:aws:iam::${scope.account}:role/cdk-hnb659fds-file-publishing-role-${scope.account}-${scope.region}`,
					`arn:aws:iam::${scope.account}:role/cdk-hnb659fds-image-publishing-role-${scope.account}-${scope.region}`
				],
				conditions: eu12Condition
			})
		]
	})
}

export function buildCloudFormationInvokerLimitedPolicy(scope, cloudFormationServiceRole) {
	return new iam.ManagedPolicy(scope, 'cloudFormationInvokerLimitedPolicy', {
		description: 'Minimum policy to actually invoke a cloudformation stack deploy.',
		statements: [
			new iam.PolicyStatement({
				//can read from S3 (needed for the invoker to check what assets are staged in s3)
				actions: ['s3:Get*', 's3:List*'],
				resources: [`arn:aws:s3:::cdk-hnb659fds-assets-${scope.account}-eu-west-2`],
				conditions: eu12Condition
			}),
			new iam.PolicyStatement({
				//can pass the service role to cloudformation
				actions: ['iam:PassRole'],
				resources: [cloudFormationServiceRole.roleArn],
				conditions: eu12Condition
			}),
			new iam.PolicyStatement({
				//can invoke cloudformation itself - WRITE actions
				actions: [
					'cloudformation:ContinueUpdateRollback',
					'cloudformation:CreateChangeSet',
					'cloudformation:CreateStack',
					'cloudformation:CreateStackSet',
					'cloudformation:UpdateStack',
					'cloudformation:UpdateStackSet'
				],
				resources: ['*'],
				conditions: {
					StringEquals: {
						...eu12Condition.StringEquals,
						//prevent the user using any other role for running cloudformation - IAM permissions are denied elsewhere to prevent changing this policy
						'cloudformation:RoleArn': [cloudFormationServiceRole.roleArn]
					}
				}
			}),
			new iam.PolicyStatement({
				//can invoke cloudformation itself - READ(ish) actions
				actions: [
					'cloudformation:CancelUpdateStack',
					'cloudformation:CreateStackInstances',
					'cloudformation:DeregisterType',
					'cloudformation:DescribeAccountLimits',
					'cloudformation:DescribeChangeSet',
					'cloudformation:DescribeStackDriftDetectionStatus',
					'cloudformation:DescribeStackEvents',
					'cloudformation:DescribeStackInstance',
					'cloudformation:DescribeStackResource',
					'cloudformation:DescribeStackResourceDrifts',
					'cloudformation:DescribeStackResources',
					'cloudformation:DescribeStackSet',
					'cloudformation:DescribeStackSetOperation',
					'cloudformation:DescribeStacks',
					'cloudformation:DescribeType',
					'cloudformation:DescribeTypeRegistration',
					'cloudformation:DetectStackDrift',
					'cloudformation:DetectStackResourceDrift',
					'cloudformation:DetectStackSetDrift',
					'cloudformation:EstimateTemplateCost',
					'cloudformation:ExecuteChangeSet',
					'cloudformation:GetStackPolicy',
					'cloudformation:GetTemplate',
					'cloudformation:GetTemplateSummary',
					'cloudformation:ListChangeSets',
					'cloudformation:ListExports',
					'cloudformation:ListImports',
					'cloudformation:ListStackInstances',
					'cloudformation:ListStackResources',
					'cloudformation:ListStackSetOperationResults',
					'cloudformation:ListStackSetOperations',
					'cloudformation:ListStackSets',
					'cloudformation:ListStacks',
					'cloudformation:ListTypeRegistrations',
					'cloudformation:ListTypeVersions',
					'cloudformation:ListTypes',
					'cloudformation:RegisterType',
					'cloudformation:SetTypeDefaultVersion',
					'cloudformation:SignalResource',
					'cloudformation:StopStackSetOperation',
					'cloudformation:TagResource',
					'cloudformation:UntagResource',
					'cloudformation:UpdateStackInstances',
					'cloudformation:UpdateTerminationProtection',
					'cloudformation:ValidateTemplate',
					'cloudformation:DeleteChangeSet',
					'ssm:GetParameter'
				],
				resources: ['*'],
				conditions: eu12Condition
			}),
			new iam.PolicyStatement({
				//...except for some things you probably won't want to do through the api (and could be dangerous) or allow a remote user to do - note these shouldn't be declared above but are explicitly denied for safety
				effect: iam.Effect.DENY,
				actions: [
					'cloudformation:DeleteChangeSet',
					'cloudformation:DeleteStack',
					'cloudformation:DeleteStackInstances',
					'cloudformation:DeleteStackSet',
					'cloudformation:SetStackPolicy'
				],
				resources: ['*']
			})
		]
	})
}

export function buildScoutSuitePolicy(scope) {
	return new iam.ManagedPolicy(scope, 'scoutSuitePolicy', {
		description: 'Minimum policy for scout suite to do its checking.',
		statements: [
			new iam.PolicyStatement({
				//copied from https://github.com/nccgroup/ScoutSuite/wiki/AWS-Minimal-Privileges-Policy
				actions: [
					'acm:ListCertificates',
					'cloudformation:DescribeStacks',
					'cloudformation:GetStackPolicy',
					'cloudformation:GetTemplate',
					'cloudformation:ListStacks',
					'cloudtrail:DescribeTrails',
					'cloudtrail:GetEventSelectors',
					'cloudtrail:GetTrailStatus',
					'cloudwatch:DescribeAlarms',
					'cognito-identity:DescribeIdentityPool',
					'cognito-identity:ListIdentityPools',
					'cognito-idp:DescribeUserPool',
					'cognito-idp:ListUserPools',
					'config:DescribeConfigRules',
					'config:DescribeConfigurationRecorderStatus',
					'config:DescribeConfigurationRecorders',
					'directconnect:DescribeConnections',
					'dynamodb:DescribeContinuousBackups',
					'dynamodb:DescribeTable',
					'dynamodb:ListBackups',
					'dynamodb:ListTables',
					'dynamodb:ListTagsOfResource',
					'ec2:DescribeCustomerGateways',
					'ec2:DescribeFlowLogs',
					'ec2:DescribeImages',
					'ec2:DescribeInstanceAttribute',
					'ec2:DescribeInstances',
					'ec2:DescribeNetworkAcls',
					'ec2:DescribeNetworkInterfaceAttribute',
					'ec2:DescribeNetworkInterfaces',
					'ec2:DescribeRegions',
					'ec2:DescribeRouteTables',
					'ec2:DescribeSecurityGroups',
					'ec2:DescribeSnapshotAttribute',
					'ec2:DescribeSnapshots',
					'ec2:DescribeSubnets',
					'ec2:DescribeVolumes',
					'ec2:DescribeVpcPeeringConnections',
					'ec2:DescribeVpcs',
					'ec2:DescribeVpnConnections',
					'ec2:DescribeVpnGateways',
					'ecr:DescribeImages',
					'ecr:DescribeRepositories',
					'ecr:GetLifecyclePolicy',
					'ecr:GetRepositoryPolicy',
					'ecr:ListImages',
					'ecs:DescribeClusters',
					'ecs:ListAccountSettings',
					'ecs:ListClusters',
					'eks:DescribeCluster',
					'eks:ListClusters',
					'elasticache:DescribeCacheClusters',
					'elasticache:DescribeCacheParameterGroups',
					'elasticache:DescribeCacheSecurityGroups',
					'elasticache:DescribeCacheSubnetGroups',
					'elasticfilesystem:DescribeFileSystems',
					'elasticfilesystem:DescribeMountTargetSecurityGroups',
					'elasticfilesystem:DescribeMountTargets',
					'elasticfilesystem:DescribeTags',
					'elasticloadbalancing:DescribeListeners',
					'elasticloadbalancing:DescribeListeners',
					'elasticloadbalancing:DescribeLoadBalancerAttributes',
					'elasticloadbalancing:DescribeLoadBalancerAttributes',
					'elasticloadbalancing:DescribeLoadBalancerPolicies',
					'elasticloadbalancing:DescribeLoadBalancers',
					'elasticloadbalancing:DescribeLoadBalancers',
					'elasticloadbalancing:DescribeSSLPolicies',
					'elasticloadbalancing:DescribeTags',
					'elasticloadbalancing:DescribeTags',
					'elasticmapreduce:DescribeCluster',
					'elasticmapreduce:ListClusters',
					'guardduty:GetDetector',
					'guardduty:ListDetectors',
					'iam:GenerateCredentialReport',
					'iam:GetAccountPasswordPolicy',
					'iam:GetCredentialReport',
					'iam:GetGroup',
					'iam:GetGroupPolicy',
					'iam:GetLoginProfile',
					'iam:GetPolicy',
					'iam:GetPolicyVersion',
					'iam:GetRole',
					'iam:GetRolePolicy',
					'iam:GetUserPolicy',
					'iam:ListAccessKeys',
					'iam:ListAttachedRolePolicies',
					'iam:ListEntitiesForPolicy',
					'iam:ListGroupPolicies',
					'iam:ListGroups',
					'iam:ListGroupsForUser',
					'iam:ListInstanceProfilesForRole',
					'iam:ListMFADevices',
					'iam:ListPolicies',
					'iam:ListRolePolicies',
					'iam:ListRoleTags',
					'iam:ListRoles',
					'iam:ListUserPolicies',
					'iam:ListUserTags',
					'iam:ListUsers',
					'iam:ListVirtualMFADevices',
					'kms:DescribeKey',
					'kms:GetKeyPolicy',
					'kms:GetKeyRotationStatus',
					'kms:ListAliases',
					'kms:ListGrants',
					'kms:ListKeys',
					'lambda:GetFunctionConfiguration',
					'lambda:GetPolicy',
					'lambda:ListFunctions',
					'logs:DescribeMetricFilters',
					'rds:DescribeDBClusterSnapshotAttributes',
					'rds:DescribeDBClusterSnapshots',
					'rds:DescribeDBClusters',
					'rds:DescribeDBInstances',
					'rds:DescribeDBParameterGroups',
					'rds:DescribeDBParameters',
					'rds:DescribeDBSecurityGroups',
					'rds:DescribeDBSnapshotAttributes',
					'rds:DescribeDBSnapshots',
					'rds:DescribeDBSubnetGroups',
					'rds:ListTagsForResource',
					'redshift:DescribeClusterParameterGroups',
					'redshift:DescribeClusterParameters',
					'redshift:DescribeClusterSecurityGroups',
					'redshift:DescribeClusters',
					'route53:ListHostedZones',
					'route53:ListResourceRecordSets',
					'route53domains:ListDomains',
					's3:GetBucketAcl',
					's3:GetBucketLocation',
					's3:GetBucketLogging',
					's3:GetBucketPolicy',
					's3:GetBucketTagging',
					's3:GetBucketVersioning',
					's3:GetBucketWebsite',
					's3:GetEncryptionConfiguration',
					's3:ListAllMyBuckets',
					'secretsmanager:ListSecrets',
					'ses:GetIdentityDkimAttributes',
					'ses:GetIdentityPolicies',
					'ses:ListIdentities',
					'ses:ListIdentityPolicies',
					'sns:GetTopicAttributes',
					'sns:ListSubscriptions',
					'sns:ListTopics',
					'sqs:GetQueueAttributes',
					'sqs:ListQueues'
				],
				resources: ['*']
			})
		]
	})
}
