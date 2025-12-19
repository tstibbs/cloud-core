import {generateKeyPairSync, createHash} from 'crypto'
import {SSMClient, GetParameterCommand, PutParameterCommand, DeleteParameterCommand} from '@aws-sdk/client-ssm'

const ssm = new SSMClient({})

export async function handler(event) {
	const requestType = event.RequestType
	const props = event.ResourceProperties || {}
	const stackName = (event.StackId && event.StackId.split('/')[1]) || 'unknown-stack'
	let paramName = props.ParameterName || event.PhysicalResourceId
	if (!paramName && requestType === 'Create') paramName = makeInternalParamName(stackName)
	if (!paramName) throw new Error('Unable to determine SSM parameter name to use')

	let data
	if (requestType === 'Delete') {
		try {
			await ssm.send(new DeleteParameterCommand({Name: paramName}))
		} catch (e) {
			console.error(e)
			// ignore if parameter not found or already deleted
		}
		data = {}
	} else if (requestType === 'Create') {
		data = await create(paramName)
	} else {
		data = await readOrCreate(paramName)
	}

	const toReturn = {
		PhysicalResourceId: paramName,
		Data: data
	}
	console.log({toReturn})
	return toReturn
}

function makeInternalParamName(stackName) {
	return `/cloud-core/${stackName}/keygen/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function readOrCreate(paramName) {
	try {
		return await readParameter(paramName)
	} catch (error) {
		if (error.name === 'ParameterNotFound') {
			console.log(`Parameter ${paramName} not found.`)
			return await create(paramName)
		}
		throw error //re-throw, there was a genuine error of some sort
	}
}

async function create(paramName) {
	await createParameter(paramName)
	return await readParameter(paramName)
}

async function readParameter(paramName) {
	const res = await ssm.send(new GetParameterCommand({Name: paramName, WithDecryption: false}))
	const data = JSON.parse(res.Parameter.Value)
	if (data.publicKeyPem == undefined || data.privateKeyPem == undefined) {
		throw new Error('malformed data')
	}
	return data
}

async function createParameter(paramName) {
	const {publicKey, privateKey} = generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: {type: 'spki', format: 'pem'},
		privateKeyEncoding: {type: 'pkcs8', format: 'pem'}
	})
	const thumbprint = createHash('sha1')
		.update(privateKey)
		.digest('base64')
		.replaceAll(/[^a-zA-Z0-9]/g, '')
	const data = {
		publicKeyPem: publicKey,
		privateKeyPem: privateKey,
		thumbprint
	}
	console.log({storing: data})
	await ssm.send(
		new PutParameterCommand({Name: paramName, Value: JSON.stringify(data), Type: 'String', Overwrite: true})
	)
}
