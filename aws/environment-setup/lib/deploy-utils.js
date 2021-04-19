import cdk from '@aws-cdk/core'
import {ParentAccountCoreStack} from '../lib/deploy-parent-core-stack.js'
import {ParentAccountInfraStack} from '../lib/deploy-parent-infra-stack.js'
import {AllAccountsStack} from '../lib/deploy-shared-stack.js'
import {InfraTrackingStack} from '../lib/deploy-infra-tracking.js'

const app = new cdk.App()

export function buildParentAccountCoreStack() {
	return new ParentAccountCoreStack(app, 'ParentAccountCoreStack')
}

export function buildParentAccountInfraStack() {
	return new ParentAccountInfraStack(app, 'ParentAccountInfraStack')
}

export function buildAllAccountsStack() {
	return new AllAccountsStack(app, 'AllAccountsStack')
}

export function buildInfraTrackingStack() {
	return new InfraTrackingStack(app, 'InfraTrackingStack')
}
