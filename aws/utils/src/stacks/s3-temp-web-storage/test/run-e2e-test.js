import axios from 'axios'
import crypto from 'crypto'
import {CloudFormationClient, DescribeStacksCommand} from '@aws-sdk/client-cloudformation'
import {stackName, httpApiPrefix} from './test-stack.js'
import {endpointGetItemUrls} from '../lib/stack.js'
import {ifCmd} from '../../../../utils.js'

async function resolveEndpoint() {
	const client = new CloudFormationClient()
	const cmd = new DescribeStacksCommand({StackName: stackName})
	const res = await client.send(cmd)
	const stacks = res.Stacks
	if (stacks == null || stacks.length == 0) {
		throw new Error('Stack not found: ' + stackName)
	}
	const outputs = stacks[0].Outputs
	let out = outputs?.find(o => o.OutputKey == 'endpointUrl')
	if (!out) throw new Error('No URL-like output found on stack: ' + stackName)
	return out.OutputValue
}

async function run() {
	try {
		// lookup endpoint from CloudFormation stack outputs
		const endpoint = `${await resolveEndpoint()}/${httpApiPrefix}/${endpointGetItemUrls}`
		const fileName = 'test-file-name.txt'

		// Request signed URLs
		const postRes = await axios.post(endpoint, {fileName}, {headers: {'Content-Type': 'application/json'}})
		const result = postRes.data
		console.log(result)

		if (!result || !result.putUrl || !result.getUrl) {
			console.error('Invalid response, missing putUrl/getUrl', result)
			process.exit(1)
		}

		// Prepare random binary content (simulate small image/pdf)
		const sizeBytes = 1024 * 80 // 80 KB
		const content = crypto.randomBytes(sizeBytes)

		// Upload via PUT to the provided URL (binary)
		await axios.put(result.putUrl, content, {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Length': content.length
			},
			maxBodyLength: Infinity
		})

		// Download the content via GET from the provided URL as arraybuffer
		const getRes = await axios.get(result.getUrl, {responseType: 'arraybuffer'})
		const downloaded = Buffer.from(getRes.data)

		if (downloaded.equals(content)) {
			console.log('SUCCESS: uploaded and downloaded binary content match (bytes:', content.length, ')')
			process.exit(0)
		}

		console.error('FAIL: binary content mismatch')
		console.error('uploaded length:', content.length)
		console.error('downloaded length:', downloaded.length)
		process.exit(2)
	} catch (err) {
		if (err.request) {
			err.method = err.request?.method
			delete err.request
		}
		if (err.response) {
			err.response = err.response?.data
		}
		if (err.config) {
			err.url = err?.config?.url
			delete err.config
		}
		throw err
	}
}

ifCmd(import.meta, async () => {
	await run()
})
