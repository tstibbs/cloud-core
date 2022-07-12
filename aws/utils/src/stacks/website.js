import { RemovalPolicy, CfnOutput, Fn, Aws } from 'aws-cdk-lib'
import { Distribution, GeoRestriction, ResponseHeadersPolicy } from 'aws-cdk-lib/aws-cloudfront'
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { Bucket } from 'aws-cdk-lib/aws-s3'

import {applicationLogsBucketRef} from './usage-tracking.js'

export function buildWebsiteResources(stack, bucketResourceName, denyCountries) {
	const websiteBucket = new Bucket(stack, bucketResourceName, {
		removalPolicy: RemovalPolicy.DESTROY,
		autoDeleteObjects: true
	})

	const distributionConstructId = 'distribution'
	const distributionProps = {
		defaultBehavior: {
			origin: new S3Origin(websiteBucket),
			responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT
		},
		logBucket: Bucket.fromBucketArn(stack, 'applicationLogsBucket', Fn.importValue(applicationLogsBucketRef)),
		logFilePrefix: `${Aws.STACK_NAME}/${distributionConstructId}`
	}
	if (denyCountries != null && denyCountries.length > 0) {
		distributionProps.geoRestriction = GeoRestriction.denylist(...denyCountries)
	}
	const distribution = new Distribution(stack, distributionConstructId, distributionProps)

	new CfnOutput(stack, 'distributionDomainName', { value: distribution.distributionDomainName })
	new CfnOutput(stack, 'bucketName', { value: websiteBucket.bucketName })
}
