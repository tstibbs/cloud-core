import cdk from 'aws-cdk-lib'
import budgets from 'aws-cdk-lib/aws-budgets'
import iam from 'aws-cdk-lib/aws-iam'
import {buildAccountMonitoring} from './deploy-parent-monitoring.js'
import {buildTooling} from './deploy-parent-tooling.js'
import {buildNotificationChannels, tagAllLambdasWithRevision} from './deploy-shared.js'
import {BUDGET} from './deploy-envs.js'

class ParentAccountInfraStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		const notificationTopic = buildNotificationChannels(this)
		buildAccountMonitoring(this, notificationTopic)
		buildTooling(this, notificationTopic)
		this.createBudgets(this, notificationTopic)
		tagAllLambdasWithRevision(this)
	}

	createBudgets(stack, notificationTopic) {
		new budgets.CfnBudget(stack, 'OrganisationBudget', {
			budget: {
				budgetType: 'COST',
				timeUnit: 'MONTHLY',
				budgetLimit: {
					amount: Number.parseFloat(BUDGET),
					unit: 'USD'
				}
			},
			notificationsWithSubscribers: [
				{
					notification: {
						notificationType: 'ACTUAL',
						comparisonOperator: 'GREATER_THAN',
						thresholdType: 'PERCENTAGE',
						threshold: 5
					},
					subscribers: [
						{
							subscriptionType: 'SNS',
							address: notificationTopic.topicArn
						}
					]
				},
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
							address: notificationTopic.topicArn
						}
					]
				}
			]
		})
		notificationTopic.grantPublish(new iam.ServicePrincipal('budgets.amazonaws.com'))
	}
}

export {ParentAccountInfraStack}
