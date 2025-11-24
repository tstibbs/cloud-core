import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'

import {Aws, Annotations, RemovalPolicy, Duration, Fn} from 'aws-cdk-lib'
import {CfnAccount} from 'aws-cdk-lib/aws-apigateway'
import {HttpLambdaIntegration} from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import {HttpApi, HttpMethod, CorsHttpMethod} from 'aws-cdk-lib/aws-apigatewayv2'
import {Bucket, HttpMethods, BucketEncryption} from 'aws-cdk-lib/aws-s3'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'
import {AllowedMethods, OriginAccessIdentity, PublicKey, KeyGroup} from 'aws-cdk-lib/aws-cloudfront'
import {S3Origin} from 'aws-cdk-lib/aws-cloudfront-origins'
import {KeyPair, PublicKeyFormat} from 'cdk-ec2-key-pair'

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
		getItemUrlsEndpoint
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

		const oai = new OriginAccessIdentity(stack, 'CloudFrontOAI', {})
		bucket.grantReadWrite(oai.grantPrincipal)
		const s3Origin = new S3Origin(bucket, {originAccessIdentity: oai})

		const keyPair = new KeyPair(stack, 'CloudFrontKeyPair', {
			keyPairName: `cloudfront-keypair`,
			publicKeyFormat: PublicKeyFormat.PEM,
			exposePublicKey: true,
			removalPolicy: RemovalPolicy.DESTROY
		})
		const publicKey = new PublicKey(stack, 'CloudFrontPublicKey', {
			encodedKey: keyPair.publicKeyValue
		})
		const keyGroup = new KeyGroup(stack, 'CloudFrontKeyGroup', {
			items: [publicKey]
		})

		cloudFrontResources.addUncachedBehaviour(`${bucketPrefix}/*`, s3Origin, {
			trustedKeyGroups: [keyGroup]
		})

		const cloudFrontPublicKeyId = publicKey.publicKeyId
		const cloudFrontPrivateKeySecret = keyPair.privateKeySecret

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

		let handler = this.#buildGenericHandler(stack, `${getItemUrlsEndpoint}-handler`, 'get-item-urls', {
			BUCKET: bucket.bucketName,
			CLOUDFRONT_DOMAIN: cloudFrontResources.distribution.domainName,
			CLOUDFRONT_KEY_PAIR_ID: cloudFrontPublicKeyId,
			CLOUDFRONT_PRIVATE_KEY_SECRET_ARN: cloudFrontPrivateKeySecret.secretArn,
			BUCKET_PREFIX: bucketPrefix
		})
		handler.addToRolePolicy(
			new PolicyStatement({
				resources: [
					bucket.arnForObjects('*') //"arn:aws:s3:::bucketname/*"
				],
				actions: ['s3:GetObject', 's3:PutObject']
			})
		)
		cloudFrontPrivateKeySecret.grantRead(handler)
		let integration = new HttpLambdaIntegration(`${getItemUrlsEndpoint}-integration`, handler)
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
