import sns from 'aws-cdk-lib/aws-sns'
import snsSubs from 'aws-cdk-lib/aws-sns-subscriptions'
import {NOTIFICATION_EMAIL} from './deploy-envs.js'

export function buildNotificationChannels(stack) {
	const notificationTopic = new sns.Topic(stack, 'notificationTopic')
	notificationTopic.addSubscription(new snsSubs.EmailSubscription(NOTIFICATION_EMAIL))
	return notificationTopic
}

export const PARENT_ACCNT_CLI_ROLE_NAME = 'ParentAccountCliRole'
