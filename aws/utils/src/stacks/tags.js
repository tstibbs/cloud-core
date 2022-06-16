import {Tags, Aws, CfnResource} from 'aws-cdk-lib'
import {exec} from '../../utils.js'
import {STACK_NAME_TAG_KEY, STACK_ID_TAG_KEY} from './constants.js'

async function getRevision() {
	let output = await exec('git rev-parse --verify HEAD')
	return output.stdout.trim()
}
const REVISION = await getRevision()

function tagAllLambdasWithRevision(stack) {
	Tags.of(stack).add('revision', REVISION, {
		includeResourceTypes: ['AWS::Lambda::Function']
	})
}

function tagResourceTree(scope, tagKey, tagValue) {
	scope.node.children.forEach(resource => {
		if (CfnResource.isCfnResource(resource)) {
			//setting the tags on a resource that doesn't support tags seems to get ignored, so it should be ok to set tags on everything
			//e.g. can't tag a managed policy: https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/819
			//nor an event rule: https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/358
			//nor AWS::IoT::Policy
			if (resource.tags !== undefined) {
				resource.tags.setTag(tagKey, tagValue)
			} else if (resource.cfnProperties?.tags !== undefined) {
				resource.cfnProperties.tags.setTag(tagKey, tagValue)
			} else if (resource._cfnProperties?.Tags != undefined) {
				resource._cfnProperties?.Tags.push({Key: tagKey, Value: tagValue})
			} else if (resource._cfnProperties != undefined) {
				resource._cfnProperties.Tags = [{Key: tagKey, Value: tagValue}]
			} else {
				console.error(`None of the usual methods of setting the ${tagKey} tag were applicable.`)
				process.exitCode = 1
			}
		}
		tagResourceTree(resource, tagKey, tagValue)
	})
}

export function applyStandardTags(stack) {
	tagAllLambdasWithRevision(stack)
	tagResourceTree(stack, STACK_NAME_TAG_KEY, Aws.STACK_NAME)
	tagResourceTree(stack, STACK_ID_TAG_KEY, Aws.STACK_ID)
}
