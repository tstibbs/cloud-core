import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'
import {readFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'

import {Aws, Annotations, RemovalPolicy, Duration, Fn} from 'aws-cdk-lib'
import {CfnAccount} from 'aws-cdk-lib/aws-apigateway'
import {HttpLambdaIntegration} from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import {HttpApi, HttpMethod, CorsHttpMethod} from 'aws-cdk-lib/aws-apigatewayv2'
import {Bucket, HttpMethods, BucketEncryption} from 'aws-cdk-lib/aws-s3'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'
import {AllowedMethods, S3OriginAccessControl, PublicKey, KeyGroup} from 'aws-cdk-lib/aws-cloudfront'
import {S3BucketOrigin} from 'aws-cdk-lib/aws-cloudfront-origins'
import {StringParameter} from 'aws-cdk-lib/aws-ssm'

import {importLogsBucket, outputUsageStoreInfo, USAGE_TYPE_S3_ACCESS_LOGS} from '../../usage-tracking.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export class S3TempWebStorageResources {
	#httpApi

	constructor(
		stack,
		cloudFrontResources,
		corsAllowedOrigins,
		objectExpiry,
		httpApiPrefix,
		bucketPrefix,
		getItemUrlsEndpoint,
		keys
	) {
		new CfnAccount(stack, 'agiGatewayAccount', {
			//use a centrally created role so that it doesn't get deleted when this stack is torn down
			cloudWatchRoleArn: Fn.importValue('AllAccountsStack-apiGatewayCloudWatchRoleArn')
		})

		const accessLogsBucket = importLogsBucket(stack, 's3')
		const bucketName = 'filesBucket'
		let bucketProps = {
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.S3_MANAGED,
			autoDeleteObjects: true,
			lifecycleRules: [
				{
					id: 'expire',
					expiration: objectExpiry //e.g. Duration.days(1)
				},
				{
					id: 'cleanup',
					abortIncompleteMultipartUploadAfter: Duration.days(1)
				}
			],
			serverAccessLogsBucket: accessLogsBucket,
			serverAccessLogsPrefix: `${Aws.STACK_NAME}/${bucketName}/`
		}
		if (corsAllowedOrigins != null) {
			bucketProps.cors = [
				{
					allowedMethods: [HttpMethods.GET, HttpMethods.PUT],
					allowedOrigins: corsAllowedOrigins,
					allowedHeaders: ['Content-Type']
				}
			]
		}
		const bucket = new Bucket(stack, bucketName, bucketProps)
		Annotations.of(bucket).acknowledgeWarning('@aws-cdk/aws-s3:accessLogsPolicyNotAdded')
		outputUsageStoreInfo(stack, bucketName, accessLogsBucket.bucketName, USAGE_TYPE_S3_ACCESS_LOGS)

		const oac = new S3OriginAccessControl(stack, 'CloudFrontOAC', {})
		const s3Origin = S3BucketOrigin.withOriginAccessControl(bucket, {originAccessControl: oac})
		const {publicKeyPem, privateKeyPem} = keys
		const cloudFrontPrivateKeyParam = new StringParameter(stack, 'CloudFrontPrivateKeyParam', {
			stringValue: privateKeyPem
		})
		const publicKey = new PublicKey(stack, 'CloudFrontPublicKey', {
			encodedKey: publicKeyPem
		})
		const keyGroup = new KeyGroup(stack, 'CloudFrontKeyGroup', {
			items: [publicKey]
		})

		cloudFrontResources.addUncachedBehaviour(`${bucketPrefix}/*`, s3Origin, {
			trustedKeyGroups: [keyGroup]
		})

		const httpApiProps = {
			apiName: `${Aws.STACK_NAME}-httpApi`
		}
		if (corsAllowedOrigins != null) {
			httpApiProps.corsPreflight = {
				allowMethods: [CorsHttpMethod.POST],
				allowOrigins: corsAllowedOrigins
			}
		}
		this.#httpApi = new HttpApi(stack, 'httpApi', httpApiProps)

		cloudFrontResources.addHttpApi(`${httpApiPrefix}/*`, this.#httpApi, AllowedMethods.ALLOW_ALL)

		let handler = this.#buildGenericHandler(stack, `get-item-urls-handler`, 'get-item-urls', {
			BUCKET: bucket.bucketName,
			CLOUDFRONT_DOMAIN: cloudFrontResources.distribution.domainName,
			CLOUDFRONT_KEY_PAIR_ID: publicKey.publicKeyId,
			CLOUDFRONT_PRIVATE_KEY_PARAM_NAME: cloudFrontPrivateKeyParam.parameterName,
			BUCKET_PREFIX: bucketPrefix
		})
		bucket.addToResourcePolicy(
			new PolicyStatement({
				resources: [
					bucket.arnForObjects('*') //"arn:aws:s3:::bucketname/*"
				],
				actions: ['s3:GetObject', 's3:PutObject'],
				principals: [handler.grantPrincipal]
			})
		)
		bucket.grantReadWrite(handler)
		cloudFrontPrivateKeyParam.grantRead(handler)

		let integration = new HttpLambdaIntegration(`get-item-urls-integration`, handler)
		this.#httpApi.addRoutes({
			path: `/${httpApiPrefix}/${getItemUrlsEndpoint}`,
			methods: [HttpMethod.POST],
			integration: integration
		})
	}

	#buildGenericHandler(stack, name, entry, envs) {
		const handler = new NodejsFunction(stack, name, {
			entry: resolve(__dirname, `../src/${entry}.js`),
			memorySize: 128,
			timeout: Duration.seconds(20),
			runtime: Runtime.NODEJS_22_X,
			environment: envs
		})
		return handler
	}

	get httpApi() {
		return this.#httpApi
	}
}

export async function loadKeys() {
	const dir = resolve(process.cwd(), 'cdk.out', 'keys')
	const pubKeyPath = resolve(dir, 'cloudfront_public.pem')
	const privKeyPath = resolve(dir, 'cloudfront_private.pem')
	if (!existsSync(pubKeyPath) || !existsSync(privKeyPath)) {
		throw new Error(
			`CloudFront key files not found in ${dir}.\nGenerate them and place in ${dir}:\n\nopenssl genrsa -out ${privKeyPath} 2048\nopenssl rsa -pubout -in ${privKeyPath} -out ${pubKeyPath}\n\nThen re-run cdk synth/deploy.`
		)
	}
	const publicKeyPem = await readFile(pubKeyPath, 'utf8')
	const privateKeyPem = await readFile(privKeyPath, 'utf8')

	return {
		publicKeyPem,
		privateKeyPem
	}
}
