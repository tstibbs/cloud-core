import cdk from '@aws-cdk/core'
import nodejsLambda from '@aws-cdk/aws-lambda-nodejs'
import lambda from '@aws-cdk/aws-lambda'
import dynamodb from '@aws-cdk/aws-dynamodb'
import eventsTargets from '@aws-cdk/aws-events-targets'
import events from '@aws-cdk/aws-events'
import iam from '@aws-cdk/aws-iam'
import {buildNotificationChannels, tagAllLambdasWithRevision} from './deploy-shared.js'
import {INFRA_TRACKING_SCHEMA} from '../src/constants.js'
import {PARENT_ACCNT_CLI_ROLE_NAME} from './deploy-shared.js'

class InfraTrackingStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)

		const lambdaBasicPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
		const infraStateCheckerFunctionsRole = new iam.Role(this, 'infraStateCheckerFunctionsRole', {
			roleName: 'infraStateCheckerFunctionsRole',
			assumedBy: new iam.CompositePrincipal(
				new iam.ServicePrincipal('lambda.amazonaws.com', {
					assumeRoleAction: 'sts:AssumeRole'
				}),
				new iam.ArnPrincipal(`arn:aws:iam::${this.account}:role/${PARENT_ACCNT_CLI_ROLE_NAME}`)
			),
			managedPolicies: [lambdaBasicPolicy]
		})

		const infraStateTable = new dynamodb.Table(this, 'infraStateTable', {
			partitionKey: INFRA_TRACKING_SCHEMA.PK,
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: cdk.RemovalPolicy.DESTROY
		})

		const notificationTopic = buildNotificationChannels(this)
		const infraStateChecker = new nodejsLambda.NodejsFunction(this, 'infraStateChecker', {
			entry: 'src/edge-infra-state-checker.js',
			environment: {
				ALERTS_TOPIC: notificationTopic.topicArn,
				TABLE_NAME: infraStateTable.tableName
			},
			memorySize: 128,
			timeout: cdk.Duration.seconds(20),
			runtime: lambda.Runtime.NODEJS_14_X,
			role: infraStateCheckerFunctionsRole
		})
		infraStateTable.grantReadData(infraStateCheckerFunctionsRole)
		notificationTopic.grantPublish(infraStateCheckerFunctionsRole)

		new events.Rule(this, 'stateCheckerTrigger', {
			schedule: events.Schedule.cron({minute: 0, hour: 1}),
			targets: [new eventsTargets.LambdaFunction(infraStateChecker)]
		})

		tagAllLambdasWithRevision(this)
	}
}

export {InfraTrackingStack}
