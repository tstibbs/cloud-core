import {App, Stack, CfnOutput, Duration} from 'aws-cdk-lib'
import {HttpOrigin} from 'aws-cdk-lib/aws-cloudfront-origins'

import {CloudFrontResources} from '../../cloudfront.js'
import {S3TempWebStorageResources} from '../lib/stack.js'
import {ifCmd} from '../../../../utils.js'

export const stackName = 'cloud-core-aws-utils-test-stack'
export const httpApiPrefix = `api`
export const bucketPrefix = `bucket`
export const endpointGetItemUrls = `get-item-urls`
const COUNTRIES_DENY_LIST = ['AQ']

class DeployStack extends Stack {
	constructor(scope, id, props) {
		super(scope, id, props)

		const cloudfrontDefaultBehavior = {
			//let's keep our various APIs separate under their own subpaths, thus let's make the default path completely invalid.
			origin: new HttpOrigin('default.not.in.use.invalid')
		}
		const cloudFrontResources = new CloudFrontResources(this, COUNTRIES_DENY_LIST, cloudfrontDefaultBehavior)

		new S3TempWebStorageResources(
			this,
			cloudFrontResources,
			null,
			Duration.days(1),
			httpApiPrefix,
			bucketPrefix,
			endpointGetItemUrls
		)
		new CfnOutput(this, 'endpointUrl', {value: `https://${cloudFrontResources.distribution.distributionDomainName}`})
	}
}

ifCmd(import.meta, () => {
	const app = new App()
	new DeployStack(app, stackName)
})
