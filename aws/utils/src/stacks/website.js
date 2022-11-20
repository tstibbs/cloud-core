import {RemovalPolicy, CfnOutput} from 'aws-cdk-lib'
import {ResponseHeadersPolicy, ViewerProtocolPolicy, AllowedMethods} from 'aws-cdk-lib/aws-cloudfront'
import {S3Origin} from 'aws-cdk-lib/aws-cloudfront-origins'
import {Bucket, BucketEncryption} from 'aws-cdk-lib/aws-s3'

import {CloudFrontResources} from './cloudfront.js'

export class WebsiteResources extends CloudFrontResources {
	constructor(stack, bucketResourceName, denyCountries) {
		const websiteBucket = new Bucket(stack, bucketResourceName, {
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.S3_MANAGED,
			autoDeleteObjects: true
		})
		const defaultBehavior = {
			origin: new S3Origin(websiteBucket),
			responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
			allowedMethods: AllowedMethods.ALLOW_GET_HEAD, //GET_HEAD is the default, but specifying it here for future compatibility
			viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY
		}
		super(stack, denyCountries, defaultBehavior)

		new CfnOutput(stack, 'bucketName', {value: websiteBucket.bucketName})
	}
}
