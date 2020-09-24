import {strictEqual} from 'assert'
import util from 'util'
import fs from 'fs'
import AWS from 'aws-sdk'
import dotenv from 'dotenv'

import {exec} from './utils.js'

dotenv.config()

AWS.config.update({region: 'eu-west-2'})
const cloudformation = new AWS.CloudFormation({apiVersion: '2010-05-15'})
const s3 = new AWS.S3({apiVersion: '2006-03-01'})
const sts = new AWS.STS({apiVersion: '2011-06-15'})

const STAGING_BUCKET_PREFIX = `cloudformation-code-deploy-staging-` // must match the cloud formation template

async function getRevision() {
	let output = await exec('git rev-parse --verify HEAD')
	return output.stdout.trim()
}

function getRevisionTags(revision) {
	return [
		{
			Key: 'revision',
			Value: revision
		}
	]
}

async function sleep(seconds) {
	await new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

async function waitUntil(generator, checker) {
	const tries = 10
	const delay = 10 //seconds
	let result = await generator()
	console.log(result)
	strictEqual(result.NextToken, undefined, 'This code is not equipped for pagination')
	let count = 1 //already tried once above
	while (!checker(result)) {
		if (count >= tries) {
			throw new Error(`Timed out - tried ${tries} times with ${delay}s delay`)
		}
		await sleep(delay)
		result = await generator()
		console.log(result)
		count++
	}
	return result
}

async function deploy(stackName, templatePath, capabilities, cfServiceRole, artifacts, parameters = {}) {
	if (cfServiceRole.length == 0) {
		throw new Error(`Must specify cfServiceRole as full arn of role cloudformation should run as.`)
	}

	const templateBody = await util.promisify(fs.readFile)(templatePath, {encoding: 'utf-8'})
	const revision = await getRevision()

	const baseParams = {
		StackName: stackName
	}

	async function getParamsFromTemplate() {
		let result = await cloudformation.getTemplateSummary({TemplateBody: templateBody}).promise()
		return Object.fromEntries(
			result.Parameters.map(param => [
				param.ParameterKey,
				{
					ParameterKey: param.ParameterKey,
					UsePreviousValue: true
				}
			])
		)
	}

	async function getStagingBucketName() {
		let callerIdentity = await sts.getCallerIdentity({}).promise()
		let accountId = callerIdentity.Account
		return STAGING_BUCKET_PREFIX + accountId
	}

	async function stageOneArtifact(file, key, revision) {
		let stagingBucketName = await getStagingBucketName()
		let stream = fs.createReadStream(file)
		let params = {Bucket: stagingBucketName, Key: key, Body: stream}
		let response = await s3.upload(params).promise()
		let tagParams = {
			Bucket: stagingBucketName,
			Key: key,
			Tagging: {
				TagSet: getRevisionTags(revision)
			}
		}
		await s3.putObjectTagging(tagParams).promise()
		return response.VersionId
	}

	async function stageArtifacts() {
		const parameters = []
		let revision = await getRevision()
		for (let [name, details] of Object.entries(artifacts)) {
			let {file, versionParameterToInject} = details
			let bucketKey = `${stackName}/${name}/code.zip` // must match the cloud formation template
			let codeVersion = await stageOneArtifact(file, bucketKey, revision)
			if (versionParameterToInject != null) {
				parameters[versionParameterToInject] = codeVersion
			}
		}
		return parameters
	}

	async function createChangeset(parameters) {
		const createParams = {
			...baseParams,
			ChangeSetName: `automated-${Date.now()}`,
			Capabilities: capabilities,
			ChangeSetType: 'UPDATE',
			TemplateBody: templateBody,
			Parameters: parameters,
			Tags: getRevisionTags(revision),
			RoleARN: cfServiceRole
		}
		let createResponse = await cloudformation.createChangeSet(createParams).promise()
		baseParams.ChangeSetName = createResponse.Id
	}

	async function waitForChangesetReady() {
		let describeResponse = await waitUntil(
			() => cloudformation.describeChangeSet(baseParams).promise(),
			response => ['CREATE_COMPLETE', 'DELETE_COMPLETE', 'FAILED'].includes(response.Status)
		)
		if (describeResponse.Status == 'FAILED') {
			throw new Error(`${describeResponse.Status}: ${describeResponse.StatusReason}`)
		}
		console.log(describeResponse.Changes)
		if (describeResponse.Changes.length == 0) {
			throw new Error('No changes to execute')
		}
	}

	async function executeChangeset() {
		let executeResponse = await cloudformation.executeChangeSet(baseParams).promise()
		console.log(executeResponse)

		//wait until execution complete
		let describeResponse = await waitUntil(
			() => cloudformation.describeChangeSet(baseParams).promise(),
			response =>
				['UNAVAILABLE', 'AVAILABLE', 'EXECUTE_COMPLETE', 'EXECUTE_FAILED', 'OBSOLETE'].includes(
					response.ExecutionStatus
				)
		)
		if (['EXECUTE_FAILED', 'OBSOLETE'].includes(describeResponse.ExecutionStatus)) {
			throw new Error(describeResponse.ExecutionStatus)
		}
	}

	function mappingToParams(mapping) {
		return Object.fromEntries(
			Object.entries(mapping).map(([name, value]) => [
				name,
				{
					ParameterKey: name,
					ParameterValue: value
				}
			])
		)
	}

	async function mergeParams(codeParameters) {
		let passedKeys = mappingToParams(parameters)
		let codeKeys = mappingToParams(codeParameters)
		let defaultKeys = await getParamsFromTemplate()
		let resolvedParams = Object.assign({}, defaultKeys, codeKeys, passedKeys)
		return Object.values(resolvedParams)
	}

	let codeParameters = await stageArtifacts()
	let mergedParameters = await mergeParams(codeParameters)

	await createChangeset(mergedParameters)
	await waitForChangesetReady()
	await executeChangeset()
	console.log('success')
}

function loadEnvs(envs) {
	let missing = Object.keys(envs).filter(env => !(env in process.env))
	if (missing.length > 0) {
		console.log(process.cwd())
		throw new Error(`${missing.join(', ')} not found in environment:\n${JSON.stringify(process.env, null, 2)}`)
	}
	return Object.fromEntries(Object.entries(envs).map(([env, varName]) => [varName, process.env[env]]))
}

export {deploy, loadEnvs}
