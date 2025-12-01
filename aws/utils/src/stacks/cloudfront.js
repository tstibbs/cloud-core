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

import {importLogsBucket, outputUsageStoreInfo, USAGE_TYPE_CLOUDFRONT} from './usage-tracking.js'

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

const cloudfrontDefaultBehavior = {
	//let's keep our various APIs separate under their own subpaths, thus let's make the default path completely invalid.
	origin: new HttpOrigin('default.not.in.use.invalid')
}

export class CloudFrontResources {
	#distribution
	#originRequestPolicy
	#responseHeaderPolicy

	constructor(
		stack,
		denyCountries,
		defaultBehavior = cloudfrontDefaultBehavior,
		corsAllowedOrigins = null,
		splitReportingByUrlRoot = false
	) {
		const logsBucket = importLogsBucket(stack, 'cloudfront')
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
		outputUsageStoreInfo(
			stack,
			distributionConstructId,
			logsBucket.bucketName,
			USAGE_TYPE_CLOUDFRONT,
			splitReportingByUrlRoot
		)

		this.#responseHeaderPolicy =
			corsAllowedOrigins == null
				? null
				: new ResponseHeadersPolicy(stack, 'CorsResponseHeadersPolicy', {
						comment: `The default ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT doesn't allow the client to pass Content-Type.`,
						corsBehavior: {
							accessControlAllowCredentials: false,
							accessControlAllowHeaders: ['*'],
							accessControlAllowMethods: AllowedMethods.ALLOW_ALL.methods,
							accessControlAllowOrigins: corsAllowedOrigins,
							originOverride: false
						}
					})
	}

	addUncachedBehaviour(path, origin, options = {}) {
		const behaviour = {
			responseHeadersPolicy: this.#responseHeaderPolicy,
			allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
			viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
			cachePolicy: CachePolicy.CACHING_DISABLED,
			originRequestPolicy: this.#originRequestPolicy,
			...options
		}
		this.#distribution.addBehavior(path, origin, behaviour)
	}

	//GET_HEAD is the default, but specifying it here for future compatibility
	addHttpApi(path, httpApi, allowedMethods = AllowedMethods.ALLOW_GET_HEAD) {
		const httpApiDomain = Fn.select(2, Fn.split('/', httpApi.url))
		this.addUncachedBehaviour(path, new HttpOrigin(httpApiDomain), {
			allowedMethods: allowedMethods
		})
	}

	addWebSocketApi(path, webSocketStage) {
		const httpApiDomain = Fn.select(2, Fn.split('/', webSocketStage.baseApi.apiEndpoint))
		this.addUncachedBehaviour(path, new HttpOrigin(httpApiDomain), {
			originPath: webSocketStage.stageName
		})
	}

	get distribution() {
		return this.#distribution
	}
}
