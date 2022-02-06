import cdk from '@aws-cdk/core'
import sns from '@aws-cdk/aws-sns'
import snsSubs from '@aws-cdk/aws-sns-subscriptions'

import {NOTIFICATION_EMAIL, REVISION} from './deploy-envs.js'

export function buildNotificationChannels(stack) {
	const notificationTopic = new sns.Topic(stack, 'notificationTopic')
	notificationTopic.addSubscription(new snsSubs.EmailSubscription(NOTIFICATION_EMAIL))
	return notificationTopic
}

export const PARENT_ACCNT_CLI_ROLE_NAME = 'ParentAccountCliRole'

export function tagAllLambdasWithRevision(stack) {
	cdk.Tags.of(stack).add('revision', REVISION, {
		includeResourceTypes: ['AWS::Lambda::Function']
	})
}
