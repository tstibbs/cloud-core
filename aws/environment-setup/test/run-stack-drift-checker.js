import {PARENT_ACCOUNT_ID} from '../lib/deploy-envs.js'
import {assumeRolePermanently} from '../src/auth-utils.js'
import {CloudFormation} from '@aws-sdk/client-cloudformation'
import {defaultAwsClientConfig} from '@tstibbs/cloud-core-utils/src/tools/aws-client-config.js'

await assumeRolePermanently(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/toolingFunctionsRole`)
let {handler, checkOneStackDriftsAcceptable} = await import('../src/cfnStackDriftChecker.js')
await handler({}, {awsRequestId: 'dummy'})

// let cloudformation = new CloudFormation(defaultAwsClientConfig)
// let acceptable = await checkOneStackDriftsAcceptable(cloudformation, 'pdf-viewer-sync')
// console.log(acceptable)
