import {strict as assert} from 'assert'
import {readFile, writeFile} from 'node:fs/promises'
import {createRequire} from 'module'
import path from 'path'

import {CloudFormationStackArtifact} from 'aws-cdk-lib/cx-api'
const require = createRequire(import.meta.url)

export async function validateBuiltAssets(buildStackFunction, expectedNumberOfAssets) {
	const templatePath = synthStack(buildStackFunction)
	console.log(templatePath)
	await writeFile(`./cdk.out/package.json`, '{"type":"commonjs"}')
	let template = JSON.parse(await readFile(templatePath))
	let zipAssets = Object.values(template.Resources)
		.filter(res => res && res.Type === 'AWS::Lambda::Function' && res.Properties?.Handler != 'framework.onEvent')
		.map(res => res.Properties?.Code?.S3Key?.replace(/\.zip$/, ''))
		.filter(Boolean)
	let handlers = zipAssets
		.map(asset => `./cdk.out/asset.${asset}/index.js`)
		.map(target => path.resolve(process.cwd(), target))
	handlers = handlers.map(asset => require(asset)).map(handler => handler.handler)
	assert.strictEqual(handlers.length, expectedNumberOfAssets)
	// check each exposes a function, that's all we can do without proper unit tests
	handlers.forEach(handler => assert.strictEqual(typeof handler, 'function'))
	//return the handlers for optional further testing
	return handlers
}

function synthStack(buildStackFunction) {
	safeSetEnv('CDK_OUTDIR', 'cdk.out')
	const stack = buildStackFunction()
	const app = stack.node.scope
	const synthResult = app.synth()
	const templateArtifacts = synthResult.artifacts.filter(CloudFormationStackArtifact.isCloudFormationStackArtifact)
	if (templateArtifacts.length != 1) {
		throw new Error('Should be exactly one stack template, was ' + templateArtifacts.length)
	}
	return templateArtifacts[0].templateFullPath
}

function safeSetEnv(key, value) {
	if (process.env[key] != undefined) {
		if (process.env[key] != value) {
			throw new Error(`Can't set ${key} to ${value}; already holds value ${process.env[key]}.`)
		}
		//else do nothing as value is already set correctly
	} else {
		process.env[key] = value
	}
}
