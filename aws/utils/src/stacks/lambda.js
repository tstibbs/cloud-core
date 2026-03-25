export function configureErrorNotifyingLambdaHandler(lambda, notificationTopic) {
	notificationTopic.grantPublish(lambda)
	lambda.addEnvironment('ALERTS_TOPIC', notificationTopic.topicArn)
}
