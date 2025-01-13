import {STS} from '@aws-sdk/client-sts'

const awsDefaults = {region: 'eu-west-2'}
const awsApiVersions = {
	Athena: '2017-05-18',
	CloudFormation: '2010-05-15',
	CloudWatchLogs: '2014-03-28',
	DynamoDB: '2012-08-10',
	IAM: '2010-05-08',
	IoT: '2015-05-28',
	S3: '2006-03-01',
	SNS: '2010-03-31',
	STS: '2011-06-15'
}

export function defaultsForAwsService(serviceName) {
	return {
		...awsDefaults,
		apiVersion: awsApiVersions[serviceName]
	}
}

export async function assumeRole(roleArn) {
	let sts = new STS(defaultsForAwsService('STS'))
	let currentAuth = await sts.getCallerIdentity({}).promise()
	let currentSessionName = currentAuth.Arn.split('/').slice(-1)[0]
	let oldCreds = aws.config.credentials
	aws.config.credentials = new aws.ChainableTemporaryCredentials({
		params: {
			RoleArn: roleArn,
			RoleSessionName: currentSessionName
		}
	})
	return oldCreds
}
