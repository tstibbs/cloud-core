import {PARENT_ACCOUNT_ID} from '../lib/deploy-envs.js'
import {assumeRolePermanently} from '../src/auth-utils.js'

await assumeRolePermanently(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/toolingFunctionsRole`)
let {handler} = await import('../src/iam-checker.js')
await handler({}, {awsRequestId: 'dummy'})
