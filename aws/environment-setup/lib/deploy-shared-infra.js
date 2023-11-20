import {Duration} from 'aws-cdk-lib'
import {CfnBudget} from 'aws-cdk-lib/aws-budgets'
import {ServicePrincipal, PolicyStatement} from 'aws-cdk-lib/aws-iam'
import {Topic} from 'aws-cdk-lib/aws-sns'
import {LambdaSubscription} from 'aws-cdk-lib/aws-sns-subscriptions'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'

import {MAX_BUDGET} from './deploy-envs.js'

function createEmergencyInfra(stack, notificationTopic) {
	const emergencyTearDownFunction = new NodejsFunction(stack, 'emergencyTearDownFunction', {
		entry: 'src/emergency-tear-down.js',
		environment: {
			ALERTS_TOPIC: notificationTopic.topicArn
		},
		initialPolicy: [
			new PolicyStatement({
				actions: ['cloudformation:DescribeStacks', 'cloudformation:DeleteStack'],
				resources: ['*']
			})
		],
		memorySize: 128,
		timeout: Duration.minutes(5),
		runtime: Runtime.NODEJS_20_X
	})
	notificationTopic.grantPublish(emergencyTearDownFunction)

	const tearDownTriggerTopic = new Topic(stack, 'tearDownTriggerTopic')
	tearDownTriggerTopic.addSubscription(new LambdaSubscription(emergencyTearDownFunction))

	new CfnBudget(stack, 'EmergencyTearDownBudget', {
		budget: {
			budgetType: 'COST',
			timeUnit: 'MONTHLY',
			budgetLimit: {
				amount: Number.parseFloat(MAX_BUDGET),
				unit: 'USD'
			}
		},
		notificationsWithSubscribers: [
			{
				notification: {
					notificationType: 'ACTUAL',
					comparisonOperator: 'GREATER_THAN',
					thresholdType: 'PERCENTAGE',
					threshold: 100
				},
				subscribers: [
					{
						subscriptionType: 'SNS',
						address: tearDownTriggerTopic.topicArn
					}
				]
			}
		]
	})
	tearDownTriggerTopic.grantPublish(new ServicePrincipal('budgets.amazonaws.com'))
}

export {createEmergencyInfra}
