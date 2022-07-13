import cdk from 'aws-cdk-lib'
import {ParentAccountCoreStack} from './deploy-parent-core-stack.js'
import {ParentAccountInfraStack} from './deploy-parent-infra-stack.js'
import {AllAccountsStack} from './deploy-shared-stack.js'
import {IotStack} from './deploy-iot.js'

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

export function buildIotStack() {
	return new IotStack(app, 'IotStack')
}

export function buildAllStacks() {
	return [
		buildParentAccountCoreStack(), //
		buildParentAccountInfraStack(), //
		buildAllAccountsStack(), //
		buildIotStack()
	]
}
