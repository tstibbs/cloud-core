import 'dotenv/config.js'
import {aws, assumeRole} from './auth-utils.js'

const alertsTopic = process.env.ALERTS_TOPIC //needs to be full arn

const sns = new aws.SNS({apiVersion: '2010-03-31'})
const s3 = new aws.S3({apiVersion: '2006-03-01'})
const iam = new aws.IAM({apiVersion: '2010-05-08'})

export async function publishNotification(message, title, invocationId) {
	await sns
		.publish({
			Message: `${message}\n\ninvocationId=${invocationId}`,
			TopicArn: alertsTopic,
			Subject: title
		})
		.promise()
	console.log('published sns alert')
}

export async function buildCfnForAccount(accountId) {
	let oldCreds = await assumeRole(`arn:aws:iam::${accountId}:role/ParentAccountCliRole`)
	let cloudformation = new aws.CloudFormation({apiVersion: '2010-05-15'})
	aws.config.credentials = oldCreds
	return cloudformation
}

export {s3, iam}
