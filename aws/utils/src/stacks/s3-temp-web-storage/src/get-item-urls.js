import {randomUUID} from 'crypto'

import {BUCKET, aws} from './utils.js'
import {endpointFileNameParam, endpointPrefixesParam} from '../shared/constants.js'
const s3 = new aws.S3()

export async function handler(event) {
	let {body} = event
	if (event.isBase64Encoded) {
		body = Buffer.from(event.body, 'base64')
	}
	body = JSON.parse(body)
	const fileName = body?.[endpointFileNameParam]
	const prefixes = body?.[endpointPrefixesParam]
	let errors = []
	if (fileName == null || fileName.length == 0) {
		errors.push(`parameter '${endpointFileNameParam}' must be specified and non-empty string`)
	}
	if (prefixes != null && (!Array.isArray(prefixes) || prefixes.length == 0)) {
		errors.push(`if specified, parameter '${endpointPrefixesParam}' must be a non-zero length array`)
	}
	if (errors.length > 0) {
		return {
			isBase64Encoded: false,
			statusCode: 400,
			body: errors.join('; ')
		}
	}
	const randomizer = randomUUID() //prevents object names in the bucket being predictable, and also prevents clashes by different files that are named the same
	const prefix = prefixes != null && prefixes.length > 0 ? [...prefixes, ''].join('/') : ''
	const key = `${prefix}${fileName}-${randomizer}`
	const sign = async operation => await s3.getSignedUrlPromise(operation, {Bucket: BUCKET, Key: key})
	const getUrl = await sign('getObject')
	const putUrl = await sign('putObject')

	return {
		getUrl,
		putUrl
	}
}
