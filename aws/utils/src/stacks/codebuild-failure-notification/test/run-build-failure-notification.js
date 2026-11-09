import {ifCmd} from '../../../../index.js'
import {wrapWithAssumedRole} from '../../../tools/assume-locally.js'
import {findPhysicalIdForCdkPath} from '../../../tools/stacks.js'

const stackName = '<StackName>'
const handlerCdkResourcePath = 'BuildNotificationsFailureHandler/Resource'

const event = {
	detail: {
		'project-name': '<project id>',
		'build-id': '<full arn of the build run>',
		'build-status': 'FAILED'
	}
}

async function run() {
	const functionName = await findPhysicalIdForCdkPath(stackName, handlerCdkResourcePath)
	await wrapWithAssumedRole(functionName, async () => {
		// import the lambda handler after credentials and env vars are set so clients inside the module use them
		const {handler} = await import('../src/build-failure-notification.js')
		await handler(event, {awsRequestId: 'dummy'})
	})
}

ifCmd(import.meta, async () => {
	await run()
})
