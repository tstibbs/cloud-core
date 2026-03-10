import {Aws, CfnResource} from 'aws-cdk-lib'
import {exec} from '../../utils.js'
import {STACK_NAME_TAG_KEY, STACK_ID_TAG_KEY} from './constants.js'

async function getRevision() {
	let revision = (await exec('git rev-parse --verify HEAD')).stdout.trim()
	const changes = (await exec('git status -s')).stdout.trim()
	if (changes.length > 0) {
		revision += '+'
	}
	return revision
}
const REVISION = await getRevision()

function tagStackWithRevision(stack) {
	stack.templateOptions.metadata = {
		...(stack.templateOptions.metadata || {}),
		revision: REVISION
	}
}

function tagResourceTree(scope, tagKey, tagValue) {
	scope.node.children.forEach(resource => {
		if (CfnResource.isCfnResource(resource) && !resource.cfnResourceType.startsWith('Custom::')) {
			//setting the tags on a resource that doesn't support tags seems to get ignored, so it should be ok to set tags on everything
			//e.g. can't tag a managed policy: https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/819
			//nor an event rule: https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/358
			//nor AWS::IoT::Policy
			try {
				if (resource.tags !== undefined) {
					resource.tags.setTag(tagKey, tagValue)
				} else if (resource.cfnProperties?.tags !== undefined) {
					resource.cfnProperties.tags.setTag(tagKey, tagValue)
				} else if (resource._cfnProperties?.Tags != undefined) {
					resource._cfnProperties?.Tags.push({Key: tagKey, Value: tagValue})
				} else if (resource._cfnProperties != undefined) {
					resource._cfnProperties.Tags = [{Key: tagKey, Value: tagValue}]
				} else {
					console.error(
						`None of the usual methods of setting tag '${tagKey}' were applicable to resource type ${resource.cfnResourceType}.`
					)
					process.exitCode = 1
				}
			} catch (e) {
				console.error(`Error setting tag '${tagKey}' on resource type ${resource.cfnResourceType}.`)
				throw e
			}
		}
		tagResourceTree(resource, tagKey, tagValue)
	})
}

export function applyStandardTags(stack) {
	tagStackWithRevision(stack)
	tagResourceTree(stack, STACK_NAME_TAG_KEY, Aws.STACK_NAME)
	tagResourceTree(stack, STACK_ID_TAG_KEY, Aws.STACK_ID)
}
