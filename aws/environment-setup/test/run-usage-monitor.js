import {ifCmd} from '@tstibbs/cloud-core-utils'
import {wrapWithAssumedRole} from '@tstibbs/cloud-core-utils/src/tools/assume-locally.js'
import {findPhysicalIdForCdkPath} from '@tstibbs/cloud-core-utils/src/tools/stacks.js'

const stackName = 'ParentAccountInfraStack'
const handlerCdkResourcePath = 'usageMonitorFunction/Resource'

async function run() {
	const functionName = await findPhysicalIdForCdkPath(stackName, handlerCdkResourcePath)
	await wrapWithAssumedRole(functionName, async () => {
		// import the lambda handler after credentials and env vars are set so clients inside the module use them
		const {handler} = await import('../src/usage-monitor.js')
		await handler({}, {awsRequestId: 'dummy'})
	})
}

ifCmd(import.meta, async () => {
	await run()
})
