import {Aws, RemovalPolicy, Duration, Fn} from 'aws-cdk-lib'
import {CfnAccount} from 'aws-cdk-lib/aws-apigateway'
import {HttpLambdaIntegration} from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import {HttpApi, HttpMethod, CorsHttpMethod} from '@aws-cdk/aws-apigatewayv2-alpha'
import {Bucket, HttpMethods, BucketEncryption} from 'aws-cdk-lib/aws-s3'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'

export class S3TempWebStorageResources {
	#bucket
	#httpApi

	constructor(stack, cloudFrontResources, corsAllowedOrigins, objectExpiry, requestsUrlPrefix, getItemUrlsEndpoint) {
		new CfnAccount(stack, 'agiGatewayAccount', {
			//use a centrally created role so that it doesn't get deleted when this stack is torn down
			cloudWatchRoleArn: Fn.importValue('AllAccountsStack-apiGatewayCloudWatchRoleArn')
		})

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
			]
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
		this.#bucket = new Bucket(stack, 'filesBucket', bucketProps)

		this.#httpApi = new HttpApi(stack, 'httpApi', {
			apiName: `${Aws.STACK_NAME}-httpApi`,
			corsPreflight: {
				allowMethods: [CorsHttpMethod.GET],
				allowOrigins: corsAllowedOrigins
			}
		})

		cloudFrontResources.addHttpApi(`${requestsUrlPrefix}/*`, this.#httpApi)

		this.#buildHandler(stack, getItemUrlsEndpoint, 'get-item-urls', requestsUrlPrefix)
	}

	#buildHandler(stack, name, entry, requestsUrlPrefix) {
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
			path: `/${requestsUrlPrefix}/${name}`,
			methods: [HttpMethod.GET],
			integration: integration
		})
	}

	#buildGenericHandler(stack, name, entry, envs) {
		const handler = new NodejsFunction(stack, name, {
			entry: `src/handlers/${entry}.js`,
			memorySize: 128,
			timeout: Duration.seconds(20),
			runtime: Runtime.NODEJS_20_X,
			environment: envs
		})
		return handler
	}

	get httpApi() {
		return this.#httpApi
	}
}
