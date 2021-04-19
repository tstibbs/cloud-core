#!/usr/bin/env node

import {
	buildAllAccountsStack,
	buildParentAccountCoreStack,
	buildParentAccountInfraStack,
	buildInfraTrackingStack
} from '../lib/deploy-utils.js'

buildAllAccountsStack()
buildParentAccountCoreStack()
buildParentAccountInfraStack()
buildInfraTrackingStack()
