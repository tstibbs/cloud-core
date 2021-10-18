import {validateCdkAssets} from '@tstibbs/cloud-core-utils'
import {buildAllAccountsStack, buildParentAccountCoreStack, buildParentAccountInfraStack} from '../lib/deploy-utils.js'

let allAccountsStack = buildAllAccountsStack()
await validateCdkAssets(allAccountsStack.stackName, 0)

let parentAccountCoreStack = buildParentAccountCoreStack()
await validateCdkAssets(parentAccountCoreStack.stackName, 0)

let parentAccountInfraStack = buildParentAccountInfraStack()
await validateCdkAssets(parentAccountInfraStack.stackName, 4) //s3 bucket emptier + cloudformation drift checker + login checker + iam permissions checker
