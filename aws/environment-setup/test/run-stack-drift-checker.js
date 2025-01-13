import {PARENT_ACCOUNT_ID} from '../lib/deploy-envs.js'
import {assumeRole} from '../src/auth-utils.js'
import aws from 'aws-sdk'

await assumeRole(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/toolingFunctionsRole`)
let {handler, checkOneStackDriftsAcceptable} = await import('../src/cfnStackDriftChecker.js')
await handler({}, {awsRequestId: 'dummy'})

//TODO comment this out by default
let cloudformation = new aws.CloudFormation()
let acceptable = await checkOneStackDriftsAcceptable(cloudformation, stack - name)
console.log(acceptable)
