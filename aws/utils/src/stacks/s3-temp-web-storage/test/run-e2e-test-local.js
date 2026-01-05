import 'dotenv/config'
import {endpointFileNameParam} from '../shared/constants.js'
import {ifCmd} from '../../../../utils.js'
import {wrapWithAssumedRole} from '../../../tools/assume-locally.js'
import {findPhysicalIdForCdkPath} from '../../../tools/stacks.js'
import {roundtrip} from './run-e2e-test-deployed.js'
import {stackName} from './test-stack.js'

const handlerCdkResourcePath = 'get-item-urls-handler/Resource'

async function run() {
	const functionName = await findPhysicalIdForCdkPath(stackName, handlerCdkResourcePath)
	await wrapWithAssumedRole(functionName, async () => {
		// Import the lambda handler after credentials and env vars are set so clients inside the module use them
		const mod = await import('../src/get-item-urls.js')
		const handler = mod.handler

		const fileName = 'test-file(-)name here.txt'
		const event = {
			isBase64Encoded: false,
			body: JSON.stringify({[endpointFileNameParam]: fileName})
		}

		// Invoke the lambda handler directly
		const result = await handler(event)
		await roundtrip(result)
	})
}

ifCmd(import.meta, async () => {
	await run()
})
