import { RemovalPolicy, CfnOutput } from '@aws-cdk/core'
import { Distribution, GeoRestriction, ResponseHeadersPolicy } from '@aws-cdk/aws-cloudfront'
import { S3Origin } from '@aws-cdk/aws-cloudfront-origins'
import { Bucket } from '@aws-cdk/aws-s3'

export function buildWebsiteResources(stack, bucketResourceName, denyCountries) {
	const bucket = new Bucket(stack, bucketResourceName, {
		removalPolicy: RemovalPolicy.DESTROY,
		autoDeleteObjects: true
	})

	const distributionProps = {
		defaultBehavior: {
			origin: new S3Origin(bucket),
			responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT
		}
	}
	if (denyCountries != null && denyCountries.length > 0) {
		distributionProps.geoRestriction = GeoRestriction.denylist(...denyCountries)
	}
	const distribution = new Distribution(stack, 'distribution', distributionProps)

	new CfnOutput(stack, 'distributionDomainName', { value: distribution.distributionDomainName })
	new CfnOutput(stack, 'bucketName', { value: bucket.bucketName })
}
