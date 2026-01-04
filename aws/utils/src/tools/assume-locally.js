import {STSClient, AssumeRoleCommand} from '@aws-sdk/client-sts'
import {LambdaClient, GetFunctionConfigurationCommand} from '@aws-sdk/client-lambda'
import {PolicyStatement, ArnPrincipal} from 'aws-cdk-lib/aws-iam'
import {Fn} from 'aws-cdk-lib'

import {CLI_ROLE_EXPORT_NAME} from '../stacks/constants.js'

const sts = new STSClient()
const lambda = new LambdaClient()

async function assumeCreds(roleArn) {
	const cmd = new AssumeRoleCommand({
		RoleArn: roleArn,
		RoleSessionName: `local-test-${Date.now()}`,
		DurationSeconds: 15 * 60
	})
	const res = await sts.send(cmd)
	const creds = res.Credentials
	if (!creds) {
		throw new Error(`Failed to assume role '${roleArn}': no credentials returned`)
	}
	return creds
}

async function getLambdaConfig(functionName) {
	const cfg = await lambda.send(new GetFunctionConfigurationCommand({FunctionName: functionName}))
	const vars = cfg.Environment?.Variables || {}
	return {
		vars,
		roleArn: cfg.Role
	}
}

export async function wrapWithAssumedRole(functionName, delegate) {
	// assume role
	const oldEnv = {...process.env}
	const {vars, roleArn} = await getLambdaConfig(functionName)
	let assumedCreds = await assumeCreds(roleArn)
	process.env.AWS_ACCESS_KEY_ID = assumedCreds.AccessKeyId
	process.env.AWS_SECRET_ACCESS_KEY = assumedCreds.SecretAccessKey
	process.env.AWS_SESSION_TOKEN = assumedCreds.SessionToken
	delete process.env.AWS_PROFILE
	Object.entries(vars).forEach(([key, value]) => {
		process.env[key] = value
	})
	// run code
	const delegateResponse = await delegate()
	// return everything to how it was before
	;['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_PROFILE', ...Object.keys(vars)].forEach(
		env => {
			if (oldEnv[env] !== undefined) {
				process.env[env] = oldEnv[env]
			} else {
				delete process.env[env]
			}
		}
	)
	return delegateResponse
}

export function allowLocalAssume(lambda) {
	//grant permissions to the CLI role so we can assume this role on the command line to test the lambda in dev
	const externalRoleArn = Fn.importValue(CLI_ROLE_EXPORT_NAME)
	lambda.role.assumeRolePolicy?.addStatements(
		new PolicyStatement({
			principals: [new ArnPrincipal(externalRoleArn)],
			actions: ['sts:AssumeRole']
		})
	)
}
