import {CloudWatchLogsClient, GetLogEventsCommand} from '@aws-sdk/client-cloudwatch-logs'
import {SNSClient, PublishCommand} from '@aws-sdk/client-sns'

import {CODEBUILD_NOTIFICATION_PREFIX} from './format.js'

const logsClient = new CloudWatchLogsClient({})
const snsClient = new SNSClient({})

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN

export const handler = async event => {
	try {
		console.log('running...')
		console.log(JSON.stringify(event, null, 2))
		// 1. Extract build details from EventBridge payload
		const detail = event.detail || {}
		const projectName = detail['project-name'] || ''
		const buildId = detail['build-id'] || ''
		const buildStatus = detail['build-status'] || ''

		if (projectName === '' || buildId === '' || buildStatus === '') {
			console.error('Blank input params')
			throw new Error('Blank input params')
		}

		if (buildStatus == 'SUCCEEDED') {
			console.log(`Build did not fail. Ignoring. (status=${buildStatus}`)
			return {statusCode: 200, body: 'Build did not fail. Ignoring.'}
		}

		// CodeBuild log stream name is typically the unique ID part after the colon
		const logStreamName = buildId.split(':').pop()
		const logGroupName = `/aws/codebuild/${projectName}`

		const extractedData = []

		try {
			// 2. Fetch logs from CloudWatch
			const command = new GetLogEventsCommand({
				logGroupName: logGroupName,
				logStreamName: logStreamName,
				startFromHead: true
			})

			const response = await logsClient.send(command)

			// 3. Scan for lines starting with "notification_text:" and parse JSON
			for (const logEvent of response.events || []) {
				const message = (logEvent.message || '').trim()
				if (message.startsWith(CODEBUILD_NOTIFICATION_PREFIX)) {
					const jsonStr = message.substring(CODEBUILD_NOTIFICATION_PREFIX.length).trim()
					try {
						const parsedJson = JSON.parse(jsonStr)
						extractedData.push(parsedJson)
					} catch (err) {
						console.error('failed to parse json:')
						console.error(err)
						extractedData.push({raw_snippet: jsonStr})
					}
				}
			}
		} catch (error) {
			extractedData.push({error: `Failed to retrieve logs: ${error.message}`})
		}

		// 4. Format the final email body
		const formattedPayload =
			extractedData.length > 0 ? extractedData.join('\n\n--------\n\n') : 'No custom notification_text found in logs.'

		const emailBody = `
🚨 BUILD FAILED: ${projectName}

Build ID: ${buildId}

Build Status: ${buildStatus}

${formattedPayload}
`.trim()

		// 5. Push to SNS
		console.log(emailBody)
		await snsClient.send(
			new PublishCommand({
				TopicArn: SNS_TOPIC_ARN,
				Subject: `Build Failed: ${projectName}`,
				Message: emailBody
			})
		)

		return {statusCode: 200, body: 'Failure notification sent to SNS successfully.'}
	} catch (e) {
		console.error(e)
		await snsClient.send(
			new PublishCommand({
				TopicArn: SNS_TOPIC_ARN,
				Subject: `Build Notification Handler failed`,
				Message: `${e}`
			})
		)
	}
}
