import aws from 'aws-sdk'
import 'dotenv/config.js'

const alertsTopic = process.env.ALERTS_TOPIC //needs to be full arn

aws.config.update({region: 'eu-west-2'})

const sts = new aws.STS({apiVersion: '2011-06-15'})
const sns = new aws.SNS({apiVersion: '2010-03-31'})
const s3 = new aws.S3({apiVersion: '2006-03-01'})

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
	let currentAuth = await sts.getCallerIdentity({}).promise()
	let currentSessionName = currentAuth.Arn.split('/').slice(-1)[0]
	let oldCreds = aws.config.credentials
	aws.config.credentials = new aws.ChainableTemporaryCredentials({
		params: {
			RoleArn: `arn:aws:iam::${accountId}:role/automation-admin-check`,
			RoleSessionName: currentSessionName
		}
	})
	let cloudformation = new aws.CloudFormation({apiVersion: '2010-05-15'})
	aws.config.credentials = oldCreds
	return cloudformation
}

export {s3}
