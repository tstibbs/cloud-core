import {PARENT_ACCOUNT_ID} from '../lib/deploy-envs.js'
import {assumeRole} from '../src/auth-utils.js'

await assumeRole(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/toolingFunctionsRole`)
let {handler} = await import('../src/iam-checker.js')
await handler({}, {awsRequestId: 'dummy'})
