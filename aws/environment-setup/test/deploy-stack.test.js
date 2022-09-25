import {checkAllPoliciesForMultipleStacks} from '@tstibbs/cloud-core-utils'
import {buildAllStacks} from '../lib/deploy-entrypoint.js'

describe('Stacks meet our policies', () => {
	checkAllPoliciesForMultipleStacks(buildAllStacks())
})
