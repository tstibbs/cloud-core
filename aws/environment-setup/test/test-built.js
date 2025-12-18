import {validateCdkAssets} from '@tstibbs/cloud-core-utils'
import {
	buildAllAccountsStack,
	buildParentAccountCoreStack,
	buildParentAccountInfraStack,
	buildIotStack
} from '../lib/deploy-entrypoint.js'

await validateCdkAssets(buildAllAccountsStack, 2) //s3 bucket emptier (shared across buckets) + emergency tear down function

await validateCdkAssets(buildParentAccountCoreStack, 0)

await validateCdkAssets(buildParentAccountInfraStack, 5) //s3 bucket emptier + cloudformation drift checker + login checker + iam permissions checker + usage monitor

await validateCdkAssets(buildIotStack, 1) //uptimeCheckerFunction
