import cdk from '@aws-cdk/core'
import iam from '@aws-cdk/aws-iam'
import nodejsLambda from '@aws-cdk/aws-lambda-nodejs'
import lambda from '@aws-cdk/aws-lambda'
import events from '@aws-cdk/aws-events'
import eventsTargets from '@aws-cdk/aws-events-targets'

import {CHILD_ACCOUNTS} from './deploy-envs.js'
import {PARENT_ACCNT_CLI_ROLE_NAME} from './deploy-shared.js'

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
			CHILD_ACCOUNTS: CHILD_ACCOUNTS.join(',')
		},
		memorySize: 128,
		timeout: cdk.Duration.minutes(5),
		runtime: lambda.Runtime.NODEJS_14_X,
		role: toolingFunctionsRole
	})

	new events.Rule(scope, 'driftCheckerFunctionSchedule', {
		schedule: events.Schedule.cron({minute: '0', hour: '0'}),
		targets: [
			new eventsTargets.LambdaFunction(driftCheckerFunction, {
				retryAttempts: 2
			})
		]
	})
}

export function buildTooling(scope, notificationTopic) {
	createLambda(scope, notificationTopic)
}
