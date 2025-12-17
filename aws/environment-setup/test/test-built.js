import {validateCdkAssets} from '@tstibbs/cloud-core-utils'
import {
	buildAllAccountsStack,
	buildParentAccountCoreStack,
	buildParentAccountInfraStack,
	buildIotStack
} from '../lib/deploy-entrypoint.js'

let allAccountsStack = buildAllAccountsStack()
await validateCdkAssets(allAccountsStack, 2) //s3 bucket emptier (shared accross buckets) + emergency tear down function

let parentAccountCoreStack = buildParentAccountCoreStack()
await validateCdkAssets(parentAccountCoreStack, 0)

let parentAccountInfraStack = buildParentAccountInfraStack()
await validateCdkAssets(parentAccountInfraStack, 5) //s3 bucket emptier + cloudformation drift checker + login checker + iam permissions checker + usage monitor

let iotStack = buildIotStack()
await validateCdkAssets(iotStack, 1) //uptimeCheckerFunction
