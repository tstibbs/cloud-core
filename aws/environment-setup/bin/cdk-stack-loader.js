#!/usr/bin/env node

import {buildAllAccountsStack, buildParentAccountCoreStack, buildParentAccountInfraStack} from '../lib/deploy-utils.js'

buildAllAccountsStack()
buildParentAccountCoreStack()
buildParentAccountInfraStack()
