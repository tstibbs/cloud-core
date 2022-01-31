import cdk from '@aws-cdk/core'
import iam from '@aws-cdk/aws-iam'
import nodejsLambda from '@aws-cdk/aws-lambda-nodejs'
import lambda from '@aws-cdk/aws-lambda'
import events from '@aws-cdk/aws-events'
import eventsTargets from '@aws-cdk/aws-events-targets'
import dynamodb from '@aws-cdk/aws-dynamodb'

import {CHILD_ACCOUNTS, RAW_CHILD_ACCOUNTS, MAX_CREDENTIAL_AGE, MAX_UNUSED_CREDENTIAL_DAYS} from './deploy-envs.js'
import {PARENT_ACCNT_CLI_ROLE_NAME} from './deploy-shared.js'
import {MONITOR_STORE_SCHEMA} from '../src/constants.js'

function createLambda(scope, notificationTopic) {
	const lambdaBasicPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
	const toolingFunctionsPolicy = new iam.ManagedPolicy(scope, 'toolingFunctionsPolicy', {
		description: 'Allows tooling to assume admin roles in child accounts.',
		statements: [
			// admin permissions on each child account
			new iam.PolicyStatement({
				actions: ['sts:AssumeRole'],
				resources: CHILD_ACCOUNTS.map(account => `arn:aws:iam::${account}:role/${PARENT_ACCNT_CLI_ROLE_NAME}`)
			})
		]
	})
	const toolingFunctionsRole = new iam.Role(scope, 'toolingFunctionsRole', {
		roleName: 'toolingFunctionsRole',
		assumedBy: new iam.CompositePrincipal(
			new iam.ServicePrincipal('lambda.amazonaws.com', {
				assumeRoleAction: 'sts:AssumeRole'
			}),
			new iam.ArnPrincipal(`arn:aws:iam::${scope.account}:role/${PARENT_ACCNT_CLI_ROLE_NAME}`)
		),
		managedPolicies: [lambdaBasicPolicy, toolingFunctionsPolicy]
	})
	notificationTopic.grantPublish(toolingFunctionsRole)

	let driftCheckerFunction = new nodejsLambda.NodejsFunction(scope, 'driftCheckerFunction', {
		entry: 'src/cfnStackDriftChecker.js',
		environment: {
			ALERTS_TOPIC: notificationTopic.topicArn,
			CHILD_ACCOUNTS: RAW_CHILD_ACCOUNTS
		},
		memorySize: 128,
		timeout: cdk.Duration.minutes(5),
		runtime: lambda.Runtime.NODEJS_14_X,
		role: toolingFunctionsRole
	})

	const monitorStoreTable = new dynamodb.Table(scope, 'monitorStoreTable', {
		partitionKey: MONITOR_STORE_SCHEMA.PK,
		billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
		removalPolicy: cdk.RemovalPolicy.DESTROY
	})
	monitorStoreTable.grantReadWriteData(toolingFunctionsRole)

	let iamCheckerFunction = new nodejsLambda.NodejsFunction(scope, 'iamCheckerFunction', {
		entry: 'src/iam-checker.js',
		environment: {
			ALERTS_TOPIC: notificationTopic.topicArn,
			CHILD_ACCOUNTS: RAW_CHILD_ACCOUNTS,
			MAX_CREDENTIAL_AGE,
			MAX_UNUSED_CREDENTIAL_DAYS,
			MONITOR_TABLE_NAME: monitorStoreTable.tableName
		},
		memorySize: 128,
		timeout: cdk.Duration.minutes(1),
		runtime: lambda.Runtime.NODEJS_14_X,
		role: toolingFunctionsRole
	})

	new events.Rule(scope, 'toolingFunctionSchedule', {
		schedule: events.Schedule.cron({minute: '0', hour: '0'}),
		targets: [
			new eventsTargets.LambdaFunction(driftCheckerFunction, {
				retryAttempts: 1
			}),
			new eventsTargets.LambdaFunction(iamCheckerFunction, {
				retryAttempts: 1
			})
		]
	})
}

export function buildTooling(scope, notificationTopic) {
	createLambda(scope, notificationTopic)
}
