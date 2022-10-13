import {RemovalPolicy, CfnOutput, Fn, Aws} from 'aws-cdk-lib'
import {
	Distribution,
	GeoRestriction,
	ResponseHeadersPolicy,
	ViewerProtocolPolicy,
	AllowedMethods
} from 'aws-cdk-lib/aws-cloudfront'
import {S3Origin} from 'aws-cdk-lib/aws-cloudfront-origins'
import {Bucket, BucketEncryption} from 'aws-cdk-lib/aws-s3'

import {applicationLogsBucketRef, outputUsageStoreInfo, USAGE_TYPE_CLOUDFRONT} from './usage-tracking.js'

export function buildWebsiteResources(stack, bucketResourceName, denyCountries) {
	const websiteBucket = new Bucket(stack, bucketResourceName, {
		removalPolicy: RemovalPolicy.DESTROY,
		encryption: BucketEncryption.S3_MANAGED,
		autoDeleteObjects: true
	})

	const logsBucket = Bucket.fromBucketArn(stack, 'applicationLogsBucket', Fn.importValue(applicationLogsBucketRef))
	const distributionConstructId = 'distribution'
	const distributionProps = {
		defaultBehavior: {
			origin: new S3Origin(websiteBucket),
			responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
			allowedMethods: AllowedMethods.ALLOW_GET_HEAD, //GET_HEAD is the default, but specifying it here for future compatibility
			viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY
		},
		logBucket: logsBucket,
		logFilePrefix: `${Aws.STACK_NAME}/${distributionConstructId}`
	}
	if (denyCountries != null && denyCountries.length > 0) {
		distributionProps.geoRestriction = GeoRestriction.denylist(...denyCountries)
	}
	const distribution = new Distribution(stack, distributionConstructId, distributionProps)

	new CfnOutput(stack, 'distributionDomainName', {value: distribution.distributionDomainName})
	new CfnOutput(stack, 'bucketName', {value: websiteBucket.bucketName})
	outputUsageStoreInfo(stack, distributionConstructId, logsBucket.bucketName, USAGE_TYPE_CLOUDFRONT)
	return distribution
}
