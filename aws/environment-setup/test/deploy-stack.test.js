import {checkAllPoliciesForMultipleStacks} from '@tstibbs/cloud-core-utils'
import {buildAllStacksForTests} from '../lib/deploy-entrypoint.js'

describe('Stacks meet our policies', () => {
	checkAllPoliciesForMultipleStacks(buildAllStacksForTests())
})
