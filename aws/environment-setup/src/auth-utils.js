import aws from 'aws-sdk'
aws.config.update({region: 'eu-west-2'})

export async function assumeRole(roleArn) {
	let sts = new aws.STS({apiVersion: '2011-06-15'})
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
