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
import {AllowedMethods} from 'aws-cdk-lib/aws-cloudfront'

import {importLogsBucket, outputUsageStoreInfo, USAGE_TYPE_S3_ACCESS_LOGS} from '../../usage-tracking.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export class S3TempWebStorageResources {
	#bucket
	#httpApi

	constructor(stack, cloudFrontResources, corsAllowedOrigins, objectExpiry, httpApiPrefix, getItemUrlsEndpoint) {
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
		this.#bucket = new Bucket(stack, bucketName, bucketProps)
		Annotations.of(this.#bucket).acknowledgeWarning('@aws-cdk/aws-s3:accessLogsPolicyNotAdded')
		outputUsageStoreInfo(stack, bucketName, accessLogsBucket.bucketName, USAGE_TYPE_S3_ACCESS_LOGS)

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

		this.#buildHandler(stack, getItemUrlsEndpoint, 'get-item-urls', httpApiPrefix)
	}

	#buildHandler(stack, name, entry, httpApiPrefix) {
		let handler = this.#buildGenericHandler(stack, `${name}-handler`, entry, {
			BUCKET: this.#bucket.bucketName
		})
		handler.addToRolePolicy(
			new PolicyStatement({
				resources: [
					this.#bucket.arnForObjects('*') //"arn:aws:s3:::bucketname/*"
				],
				actions: ['s3:GetObject', 's3:PutObject']
			})
		)
		let integration = new HttpLambdaIntegration(`${name}-integration`, handler)
		this.#httpApi.addRoutes({
			path: `/${httpApiPrefix}/${name}`,
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
