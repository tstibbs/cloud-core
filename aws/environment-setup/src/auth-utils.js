import aws from 'aws-sdk'
aws.config.update({region: 'eu-west-2'})
aws.config.apiVersions = {
	athena: '2017-05-18',
	cloudformation: '2010-05-15',
	cloudwatchlogs: '2014-03-28',
	dynamodb: '2012-08-10',
	iam: '2010-05-08',
	iot: '2015-05-28',
	s3: '2006-03-01',
	sns: '2010-03-31',
	sts: '2011-06-15'
}

export async function assumeRole(roleArn) {
	let sts = new aws.STS()
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

export {aws}
