export * from '../src/runtime-envs.js'

import {exec} from '@tstibbs/cloud-core-utils'

let {STACK_NAME} = process.env
if (STACK_NAME == null || STACK_NAME.length == 0) {
	STACK_NAME = 'Default'
}
export {STACK_NAME}

async function getRevision() {
	let output = await exec('git rev-parse --verify HEAD')
	return output.stdout.trim()
}

export const REVISION = await getRevision()
