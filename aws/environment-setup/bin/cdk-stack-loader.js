#!/usr/bin/env node

import {
	buildAllAccountsStack,
	buildParentAccountCoreStack,
	buildParentAccountInfraStack,
	buildIotStack
} from '../lib/deploy-utils.js'

buildAllAccountsStack()
buildParentAccountCoreStack()
buildParentAccountInfraStack()
buildIotStack()
