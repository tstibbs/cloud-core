import {App} from 'aws-cdk-lib'

import {validateCdkAssets} from '@tstibbs/cloud-core-utils'
import {
	buildAllAccountsStack,
	buildParentAccountCoreStack,
	buildParentAccountInfraStack,
	buildIotStack
} from '../lib/deploy-entrypoint.js'

const buildStack = stack => () => stack(new App())

await validateCdkAssets(buildStack(buildAllAccountsStack), 2) //s3 bucket emptier (shared across buckets) + emergency tear down function

await validateCdkAssets(buildStack(buildParentAccountCoreStack), 0)

await validateCdkAssets(buildStack(buildParentAccountInfraStack), 5) //s3 bucket emptier + cloudformation drift checker + login checker + iam permissions checker + usage monitor

await validateCdkAssets(buildStack(buildIotStack), 1) //uptimeCheckerFunction
