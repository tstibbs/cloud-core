import dotenv from 'dotenv'

import {exec} from '@tstibbs/cloud-core-utils'

dotenv.config()
let {STACK_NAME} = process.env
if (STACK_NAME == null || STACK_NAME.length == 0) {
	STACK_NAME = 'Default'
}
export {STACK_NAME}

export const {NOTIFICATION_EMAIL, CHILD_ACCOUNTS, BUDGET, IP_RANGES, PARENT_ACCOUNT_ID, ORG_ID} = process.env

async function getRevision() {
	let output = await exec('git rev-parse --verify HEAD')
	return output.stdout.trim()
}

export const REVISION = await getRevision()
