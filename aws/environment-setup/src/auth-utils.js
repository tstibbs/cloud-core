import {STS} from '@aws-sdk/client-sts'
import {defaultAwsClientConfig} from '@tstibbs/cloud-core-utils/src/tools/aws-client-config.js'
import {fromTemporaryCredentials, fromNodeProviderChain} from '@aws-sdk/credential-providers'

const credentials = [fromNodeProviderChain()]

function _getCurrentCreds() {
	return credentials[credentials.length - 1]
}

export function defaultsForAwsService(serviceName) {
	return {
		...defaultAwsClientConfig,
		credentials: _getCurrentCreds()
	}
}

async function _buildCreds(roleArn) {
	let sts = new STS(defaultsForAwsService())
	let currentAuth = await sts.getCallerIdentity({})
	let currentSessionName = currentAuth.Arn.split('/').slice(-1)[0]
	return fromTemporaryCredentials({
		masterCredentials: _getCurrentCreds(),
		params: {
			RoleArn: roleArn,
			RoleSessionName: currentSessionName
		}
	})
}

export async function assumeRolePermanently(roleArn) {
	credentials.push(await _buildCreds(roleArn))
}

export async function assumeRoleTemporarily(roleArn) {
	return {
		credentials: await _buildCreds(roleArn)
	}
}
