import {checkAllStackPolicies} from '@tstibbs/cloud-core-utils'
import {buildParentStack, buildSharedStack} from '../lib/deploy-utils.js'

describe('Stacks meet our policies', () => {
	checkAllStackPolicies(buildParentStack())
	checkAllStackPolicies(buildSharedStack())
})
