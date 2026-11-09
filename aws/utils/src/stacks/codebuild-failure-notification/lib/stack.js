import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'

import {Duration} from 'aws-cdk-lib'
import {Rule} from 'aws-cdk-lib/aws-events'
import {LambdaFunction} from 'aws-cdk-lib/aws-events-targets'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'
import {Topic} from 'aws-cdk-lib/aws-sns'
import {EmailSubscription} from 'aws-cdk-lib/aws-sns-subscriptions'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'

import {allowLocalAssume} from '../../../tools/assume-locally.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export class CodeBuildFailureNotifications {
	#stack
	#handler

	constructor(stack, notificationEmail) {
		this.#stack = stack
		const notificationTopic = new Topic(stack, 'BuildNotificationsTopic', {topicName: 'build-notifications'})
		notificationTopic.addSubscription(new EmailSubscription(notificationEmail))
		this.#handler = new NodejsFunction(stack, 'BuildNotificationsFailureHandler', {
			entry: resolve(__dirname, '../src/build-failure-notification.js'),
			memorySize: 128,
			timeout: Duration.seconds(30),
			runtime: Runtime.NODEJS_22_X,
			environment: {
				SNS_TOPIC_ARN: notificationTopic.topicArn
			}
		})
		allowLocalAssume(this.#handler)
		notificationTopic.grantPublish(this.#handler)
		this.#handler.addToRolePolicy(
			new PolicyStatement({
				actions: ['logs:GetLogEvents'],
				resources: [
					`arn:${stack.partition}:logs:${stack.region}:${stack.account}:log-group:/aws/codebuild/*:log-stream:*`
				]
			})
		)
	}

	addProject(codeBuildProject, ruleName) {
		const projectName = codeBuildProject.projectName
		const rule = new Rule(this.#stack, `CodeBuildFailureRule-${ruleName}`, {
			ruleName: `codebuild-failure-notify-${projectName}`,
			eventPattern: {
				source: ['aws.codebuild'],
				detailType: ['CodeBuild Build State Change'],
				detail: {
					'build-status': ['FAILED'],
					'project-name': [projectName]
				}
			}
		})
		rule.addTarget(new LambdaFunction(this.#handler))
	}
}
