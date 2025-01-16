import {STS} from '@aws-sdk/client-sts'
import {defaultAwsClientConfig} from '@tstibbs/cloud-core-utils/src/tools/aws-client-config.js'
import {fromTemporaryCredentials, fromNodeProviderChain} from '@aws-sdk/credential-providers'

export function defaultsForAwsService(serviceName) {
	//TODO remove this
	return {
		...defaultAwsClientConfig
	}
}

export async function assumeRole(roleArn) {
	let sts = new STS(defaultAwsClientConfig)
	let currentAuth = await sts.getCallerIdentity({})
	let currentSessionName = currentAuth.Arn.split('/').slice(-1)[0]
	return {
		credentials: fromTemporaryCredentials({
			masterCredentials: fromNodeProviderChain(),
			params: {
				RoleArn: roleArn,
				RoleSessionName: currentSessionName
			}
		})
	}
}
