import {checkAllStackPolicies} from '@tstibbs/cloud-core-utils'
import {
	buildParentAccountCoreStack,
	buildParentAccountInfraStack,
	buildAllAccountsStack,
	buildInfraTrackingStack
} from '../lib/deploy-utils.js'

describe('Stacks meet our policies', () => {
	checkAllStackPolicies(buildParentAccountCoreStack())
	checkAllStackPolicies(buildParentAccountInfraStack())
	checkAllStackPolicies(buildAllAccountsStack())
	checkAllStackPolicies(buildInfraTrackingStack())
})
