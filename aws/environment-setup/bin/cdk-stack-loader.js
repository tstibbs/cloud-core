#!/usr/bin/env node

import {
	buildAllAccountsStack,
	buildParentAccountCoreStack,
	buildParentAccountInfraStack,
	buildIotStack
} from '../lib/deploy-entrypoint.js'

buildAllAccountsStack()
buildParentAccountCoreStack()
buildParentAccountInfraStack()
buildIotStack()
