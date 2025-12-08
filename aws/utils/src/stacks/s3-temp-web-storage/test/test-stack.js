import {App, Stack, CfnOutput, Duration} from 'aws-cdk-lib'

import {CloudFrontResources} from '../../cloudfront.js'
import {S3TempWebStorageResources, loadKeys} from '../lib/stack.js'
import {ifCmd, applyStandardTags} from '../../../../index.js'

export const stackName = 'cloud-core-aws-utils-test-stack'
export const httpApiPrefix = `api`
export const bucketPrefix = `bucket`
export const endpointGetItemUrls = `getItemUrlsAbcdef` //deliberately an odd name to test that it's being used properly
const COUNTRIES_DENY_LIST = ['AQ']

class DeployStack extends Stack {
	constructor(scope, id, props) {
		super(scope, id, props)

		const cloudFrontResources = new CloudFrontResources(this, COUNTRIES_DENY_LIST)

		new S3TempWebStorageResources(
			this,
			cloudFrontResources,
			null,
			Duration.days(1),
			httpApiPrefix,
			bucketPrefix,
			endpointGetItemUrls,
			props.keys
		)
		new CfnOutput(this, 'endpointUrl', {value: `https://${cloudFrontResources.distribution.distributionDomainName}`})

		applyStandardTags(this)
	}
}

export async function buildStack() {
	const keys = await loadKeys()
	const app = new App()
	return new DeployStack(app, stackName, {keys})
}

ifCmd(import.meta, buildStack)
