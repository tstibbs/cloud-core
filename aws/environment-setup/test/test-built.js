import {validateCdkAssets} from '@tstibbs/cloud-core-utils'
import {buildParentStack, buildSharedStack} from '../lib/deploy-utils.js'

let sharedStack = buildSharedStack()
await validateCdkAssets(sharedStack.stackName, 0)

let parentStack = buildParentStack()
await validateCdkAssets(parentStack.stackName, 2)
