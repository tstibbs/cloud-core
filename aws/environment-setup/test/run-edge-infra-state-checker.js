import {CURRENT_ACCOUNT} from '../lib/deploy-envs.js'
import {assumeRole} from '../src/auth-utils.js'

await assumeRole(`arn:aws:iam::${CURRENT_ACCOUNT}:role/infraStateCheckerFunctionsRole`)
let {handler} = await import('../src/edge-infra-state-checker.js')
await handler({}, {awsRequestId: 'dummy'})
