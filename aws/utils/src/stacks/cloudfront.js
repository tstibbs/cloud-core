import {CfnOutput, Fn, Aws} from 'aws-cdk-lib'
import {
	Distribution,
	GeoRestriction,
	ResponseHeadersPolicy,
	ViewerProtocolPolicy,
	AllowedMethods,
	CachePolicy,
	OriginRequestHeaderBehavior,
	OriginRequestQueryStringBehavior,
	OriginRequestPolicy
} from 'aws-cdk-lib/aws-cloudfront'
import {HttpOrigin} from 'aws-cdk-lib/aws-cloudfront-origins'
import {Bucket} from 'aws-cdk-lib/aws-s3'

import {applicationLogsBucketRef, outputUsageStoreInfo, USAGE_TYPE_CLOUDFRONT} from './usage-tracking.js'

const cloudFrontPassThroughHeaders = [
	'Sec-WebSocket-Key',
	'Sec-WebSocket-Version',
	'Sec-WebSocket-Protocol',
	'Accept',
	'Origin',
	'Referer',
	'Content-Type',
	'Content-Length',
	'User-Agent',
	'X-Requested-With'
]

export class CloudFrontResources {
	#distribution
	#originRequestPolicy

	constructor(stack, denyCountries, defaultBehavior) {
		const logsBucket = Bucket.fromBucketArn(stack, 'applicationLogsBucket', Fn.importValue(applicationLogsBucketRef))
		const distributionConstructId = 'distribution'
		const distributionProps = {
			defaultBehavior: defaultBehavior,
			logBucket: logsBucket,
			logFilePrefix: `${Aws.STACK_NAME}/${distributionConstructId}`
		}
		if (denyCountries != null && denyCountries.length > 0) {
			distributionProps.geoRestriction = GeoRestriction.denylist(...denyCountries)
		}
		this.#distribution = new Distribution(stack, distributionConstructId, distributionProps)

		this.#originRequestPolicy = new OriginRequestPolicy(this.#distribution.stack, 'originRequestPolicy', {
			headerBehavior: OriginRequestHeaderBehavior.allowList(...cloudFrontPassThroughHeaders),
			queryStringBehavior: OriginRequestQueryStringBehavior.all()
		})

		new CfnOutput(stack, 'distributionDomainName', {value: this.#distribution.distributionDomainName})
		outputUsageStoreInfo(stack, distributionConstructId, logsBucket.bucketName, USAGE_TYPE_CLOUDFRONT)
	}

	addHttpApi(path, httpApi) {
		const httpApiDomain = Fn.select(2, Fn.split('/', httpApi.url))
		this.#distribution.addBehavior(path, new HttpOrigin(httpApiDomain), {
			responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
			allowedMethods: AllowedMethods.ALLOW_GET_HEAD, //GET_HEAD is the default, but specifying it here for future compatibility
			viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
			cachePolicy: CachePolicy.CACHING_DISABLED,
			originRequestPolicy: this.#originRequestPolicy
		})
	}

	addWebSocketApi(path, webSocketStage) {
		const httpApiDomain = Fn.select(2, Fn.split('/', webSocketStage.baseApi.apiEndpoint))
		this.#distribution.addBehavior(path, new HttpOrigin(httpApiDomain), {
			originPath: webSocketStage.stageName,
			responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
			allowedMethods: AllowedMethods.ALLOW_GET_HEAD, //GET_HEAD is the default, but specifying it here for future compatibility
			viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
			cachePolicy: CachePolicy.CACHING_DISABLED,
			originRequestPolicy: this.#originRequestPolicy
		})
	}
}
