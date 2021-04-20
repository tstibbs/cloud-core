import cdk from '@aws-cdk/core'
import {ParentStack} from '../lib/deploy-parent-stack.js'
import {SharedStack} from '../lib/deploy-shared-stack.js'

const app = new cdk.App()

export function buildParentStack() {
	return new ParentStack(app, 'ParentStack')
}

export function buildSharedStack() {
	return new SharedStack(app, 'SharedStack')
}
