import {ok as assertOk} from 'node:assert/strict'

import {SNS} from '@aws-sdk/client-sns'

const sns = new SNS()

const {
	ALERTS_TOPIC //needs to be full arn
} = process.env

export function buildErrorNotifyingLambdaHandler(workloadDescriptor, delegate) {
	assertOk(ALERTS_TOPIC, `ALERTS_TOPIC must be set and non-empty`)
	const handleEvent = async (event, context) => {
		let invocationId = context.awsRequestId
		console.log(`invocationId=${invocationId}`) //just to make it easy to match up an email and a log entry
		try {
			await delegate(event, context)
		} catch (e) {
			console.error(e)
			console.log('publishing sns alert for error')
			let message = `Error occurred running ${workloadDescriptor}: \n${e.stack}\n${JSON.stringify(e.originalError, null, 2)}`
			await publishNotification(message, `AWS account ${workloadDescriptor} alert`, invocationId)
			throw e //because we want the lambda invocation to be marked as a failure
		}
	}
	return handleEvent
}

export async function publishNotification(message, title, invocationId) {
	assertOk(ALERTS_TOPIC, `ALERTS_TOPIC must be set and non-empty`)
	await sns.publish({
		Message: `${message}\n\ninvocationId=${invocationId}\n\n${getCurrentLambdaLogsLink()}`,
		TopicArn: ALERTS_TOPIC,
		Subject: title
	})
	console.log('published sns alert')
}

function getCurrentLambdaLogsLink() {
	const {AWS_REGION, AWS_LAMBDA_LOG_GROUP_NAME, AWS_LAMBDA_LOG_STREAM_NAME} = process.env
	const encode = input => encodeURIComponent(encodeURIComponent(input)).replace(/%/g, '$')
	return `https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups/log-group/${encode(
		AWS_LAMBDA_LOG_GROUP_NAME
	)}/log-events/${encode(AWS_LAMBDA_LOG_STREAM_NAME)}`
}
