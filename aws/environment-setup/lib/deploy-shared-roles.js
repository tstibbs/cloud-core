import iam from 'aws-cdk-lib/aws-iam'

/* This file just contains roles with lots of actions, to prevent the large text blocks making it hard to read the main stack file */

const bootstrapQualifier = 'hnb659fds' // this is the default value, unlikely to need to change it (hence the hard-coding) but pulled out to make it easy to change if necessary
const eu12Condition = {
	StringEquals: {
		'aws:RequestedRegion': ['eu-west-1', 'eu-west-2']
	}
}

export function buildDeveloperPolicy(stack) {
	return new iam.ManagedPolicy(stack, 'developerPolicy', {
		managedPolicyName: 'developerPolicy',
		description: `Sensible permissive policy for a developer, including IAM access.`,
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
					'ecr:*',
					'events:*',
					'glue:*',
					'iot:*',
					'kinesis:*',
					'kms:*',
					'lambda:*',
					'logs:*',
					's3:*',
					'ses:*',
					'sns:*',
					'sqs:*',
					'ssm:*',
					//read only access to config, somewhat different to arn:aws:iam::aws:policy/AWSConfigUserAccess for reasons I don't necessarily understand
					'config:BatchGet*',
					'config:Describe*',
					'config:Get*',
					'config:List*',
					//read only access to budgets, copied from arn:aws:iam::aws:policy/AWSBudgetsReadOnlyAccess just so we have a single policy we can reference in the bootstrap command
					'budgets:ViewBudget',
					'budgets:Describe*'
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
					'iam:*'
				],
				resources: ['*']
			})
		]
	})
}

export function buildCloudFormationInvokerPolicy(stack) {
	return new iam.ManagedPolicy(stack, 'cloudFormationInvokerPolicy', {
		description: 'Gives permission to assume roles required for CDK.',
		statements: [
			new iam.PolicyStatement({
				//can assume the various CDK roles
				actions: ['sts:AssumeRole'],
				resources: [
					`arn:aws:iam::${stack.account}:role/cdk-${bootstrapQualifier}-file-publishing-role-${stack.account}-${stack.region}`,
					`arn:aws:iam::${stack.account}:role/cdk-${bootstrapQualifier}-image-publishing-role-${stack.account}-${stack.region}`,
					`arn:aws:iam::${stack.account}:role/cdk-${bootstrapQualifier}-lookup-role-${stack.account}-${stack.region}`,
					`arn:aws:iam::${stack.account}:role/cdk-${bootstrapQualifier}-deploy-role-${stack.account}-${stack.region}`
				],
				conditions: eu12Condition
			})
		]
	})
}

export function buildScoutSuitePolicy(stack) {
	return new iam.ManagedPolicy(stack, 'scoutSuitePolicy', {
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
