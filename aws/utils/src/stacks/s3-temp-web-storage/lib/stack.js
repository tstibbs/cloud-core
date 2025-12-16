import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'

import {Aws, Annotations, RemovalPolicy, Duration, Fn, CustomResource} from 'aws-cdk-lib'
import {Provider} from 'aws-cdk-lib/custom-resources'
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
		const {publicKeyPem, privateKeyPem} = this.#createKeyPair(stack)
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

	#buildGenericHandler(stack, name, entry, envs = {}) {
		const handler = new NodejsFunction(stack, name, {
			entry: resolve(__dirname, `../src/${entry}.js`),
			memorySize: 128,
			timeout: Duration.seconds(20),
			runtime: Runtime.NODEJS_22_X,
			environment: envs
		})
		return handler
	}

	#createKeyPair(stack) {
		const keyGeneratorFn = this.#buildGenericHandler(stack, 'KeyGeneratorFunction', 'generate-keys')
		keyGeneratorFn.addToRolePolicy(
			new PolicyStatement({
				actions: ['ssm:PutParameter', 'ssm:GetParameter', 'ssm:DeleteParameter'],
				resources: [`arn:aws:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:parameter/cloud-core/*/keygen/*`]
			})
		)

		const provider = new Provider(stack, 'KeyGenProvider', {
			onEventHandler: keyGeneratorFn
		})
		const keyResource = new CustomResource(stack, 'KeyGenResource', {
			serviceToken: provider.serviceToken
		})

		const publicKeyPem = keyResource.getAttString('publicKeyPem')
		const privateKeyPem = keyResource.getAttString('privateKeyPem')
		return {
			publicKeyPem,
			privateKeyPem
		}
	}

	get httpApi() {
		return this.#httpApi
	}
}
