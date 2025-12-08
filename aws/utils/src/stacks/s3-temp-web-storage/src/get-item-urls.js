import {randomUUID} from 'crypto'

import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
import {SSMClient, GetParameterCommand} from '@aws-sdk/client-ssm'
import {getSignedUrl as getS3SignedUrl} from '@aws-sdk/s3-request-presigner'
import {getSignedUrl as getCloudFrontSignedUrl} from '@aws-sdk/cloudfront-signer'
import {endpointFileNameParam, endpointPrefixesParam} from '../shared/constants.js'
import {defaultAwsClientConfig} from '../../../tools/aws-client-config.js'

const PUT_URL_EXPIRES_SECONDS = 5 * 60 // 5 minutes
const GET_URL_EXPIRES_SECONDS = 2 * 24 * 60 * 60 // 2 days
const {
	CLOUDFRONT_DOMAIN, //
	CLOUDFRONT_KEY_PAIR_ID, //
	CLOUDFRONT_PRIVATE_KEY_PARAM_NAME, //
	BUCKET_PREFIX, //
	BUCKET //
} = process.env

const ssmClient = new SSMClient(defaultAwsClientConfig)
const s3Client = new S3Client(defaultAwsClientConfig)
let cachedPrivateKey = null

async function fetchParameter(parameterName) {
	const cmd = new GetParameterCommand({Name: parameterName, WithDecryption: false})
	const res = await ssmClient.send(cmd)
	return res.Parameter ? res.Parameter.Value : null
}

async function ensurePrivateKey() {
	if (cachedPrivateKey) return cachedPrivateKey
	if (CLOUDFRONT_PRIVATE_KEY_PARAM_NAME) {
		cachedPrivateKey = await fetchParameter(CLOUDFRONT_PRIVATE_KEY_PARAM_NAME)
	}
	if (!cachedPrivateKey) {
		throw new Error(
			'CloudFront private key not provided. Set CLOUDFRONT_PRIVATE_KEY_PARAM_NAME to the SSM parameter name containing the private key (stored as plain String).'
		)
	}
	return cachedPrivateKey
}

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

	//adding a bucket prefix allows the paths to match up with cloudfront's origin path
	const key = `${BUCKET_PREFIX}/${prefix}${fileName}-${randomizer}`

	// use s3 presigned urls for PUT
	const putCommand = new PutObjectCommand({Bucket: BUCKET, Key: key})
	const putUrl = await getS3SignedUrl(s3Client, putCommand, {
		expiresIn: PUT_URL_EXPIRES_SECONDS
	})

	// use cloudfront signed urls for GET
	const resourceUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`
	const expires = Date.now() + GET_URL_EXPIRES_SECONDS * 1000
	const privateKey = await ensurePrivateKey()
	const getUrl = getCloudFrontSignedUrl({
		url: resourceUrl,
		dateLessThan: new Date(expires),
		privateKey,
		keyPairId: CLOUDFRONT_KEY_PAIR_ID
	})

	return {
		getUrl,
		putUrl
	}
}
