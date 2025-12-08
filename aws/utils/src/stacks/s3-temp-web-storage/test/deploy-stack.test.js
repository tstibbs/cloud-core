import {checkAllStackPolicies} from '../../../../index.js'
import {buildStack} from './test-stack.js'

const stack = await buildStack()

describe('Stack meets our policies', () => {
	checkAllStackPolicies(stack)
})
