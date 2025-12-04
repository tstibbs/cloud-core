import {checkAllStackPolicies} from '../../../../index.js'
import {buildStack} from './test-stack.js'

describe('Stack meets our policies', () => {
	checkAllStackPolicies(buildStack())
})
