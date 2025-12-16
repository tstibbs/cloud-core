import {generateKeyPairSync, createPublicKey} from 'crypto'
import {SSMClient, GetParameterCommand, PutParameterCommand, DeleteParameterCommand} from '@aws-sdk/client-ssm'

const ssm = new SSMClient({})

function makeInternalParamName(stackName) {
	return `/cloud-core/${stackName}/keygen/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export async function handler(event) {
	const requestType = event.RequestType
	const props = event.ResourceProperties || {}
	const stackName = (event.StackId && event.StackId.split('/')[1]) || 'unknown-stack'
	let paramName = props.ParameterName || event.PhysicalResourceId
	if (!paramName && requestType === 'Create') paramName = makeInternalParamName(stackName)
	if (!paramName) throw new Error('Unable to determine SSM parameter name to use')

	if (requestType === 'Delete') {
		try {
			await ssm.send(new DeleteParameterCommand({Name: paramName}))
		} catch (e) {
			console.error(e)
			// ignore if parameter not found or already deleted
		}
		return {PhysicalResourceId: paramName, Data: {}}
	}

	// For Create/Update: try to read an existing parameter first
	try {
		const res = await ssm.send(new GetParameterCommand({Name: paramName, WithDecryption: false}))
		if (res.Parameter && res.Parameter.Value) {
			const privateKey = res.Parameter.Value
			const publicKeyObj = createPublicKey(privateKey)
			const publicKeyPem = publicKeyObj.export({type: 'spki', format: 'pem'})
			return {
				PhysicalResourceId: paramName,
				Data: {
					publicKeyPem,
					privateKeyPem: privateKey
				}
			}
		}
	} catch (e) {
		console.error(e)
		// If parameter not found, proceed to generate a new pair
	}

	// No existing parameter found — generate and persist
	const {publicKey, privateKey} = generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: {type: 'spki', format: 'pem'},
		privateKeyEncoding: {type: 'pkcs8', format: 'pem'}
	})

	// Use Overwrite=true for Update requests, false for initial Create
	const overwrite = event.RequestType === 'Update'
	await ssm.send(new PutParameterCommand({Name: paramName, Value: privateKey, Type: 'String', Overwrite: overwrite}))

	return {
		PhysicalResourceId: paramName,
		Data: {
			publicKeyPem: publicKey,
			privateKeyPem: privateKey
		}
	}
}
