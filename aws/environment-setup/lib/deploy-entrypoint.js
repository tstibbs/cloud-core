import {App} from 'aws-cdk-lib'
import {ParentAccountCoreStack} from './deploy-parent-core-stack.js'
import {ParentAccountInfraStack} from './deploy-parent-infra-stack.js'
import {AllAccountsStack} from './deploy-shared-stack.js'
import {IotStack} from './deploy-iot.js'
import {DEV_MODE, DEV_SUFFIX} from './deploy-envs.js'
import {SHARED_STACK_NAME} from '@tstibbs/cloud-core-utils/src/stacks/constants.js'

const terminationProtection = !DEV_MODE //i.e. enable termination protection when deploying in prod mode

const app = new App()

export function buildParentAccountCoreStack() {
	return new ParentAccountCoreStack(app, `ParentAccountCoreStack${DEV_SUFFIX}`, {
		terminationProtection: terminationProtection
	})
}

export function buildParentAccountInfraStack() {
	return new ParentAccountInfraStack(app, `ParentAccountInfraStack${DEV_SUFFIX}`, {
		terminationProtection: terminationProtection
	})
}

export function buildAllAccountsStack() {
	return new AllAccountsStack(app, `${SHARED_STACK_NAME}${DEV_SUFFIX}`, {
		terminationProtection: terminationProtection
	})
}

export function buildIotStack() {
	return new IotStack(app, `IotStack${DEV_SUFFIX}`)
}

export function buildAllStacks() {
	return [
		buildParentAccountCoreStack(), //
		buildParentAccountInfraStack(), //
		buildAllAccountsStack(), //
		buildIotStack()
	]
}
