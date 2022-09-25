import {assumeRole} from '../src/auth-utils.js'
import {PARENT_ACCOUNT_ID} from '../src/runtime-envs.js'

await assumeRole(`arn:aws:iam::${PARENT_ACCOUNT_ID}:role/usageMonitorRunner`)

//import asynchronously so it is inited as the role assumed above
let {handler} = await import('../src/usage-monitor.js')
await handler({}, {awsRequestId: 'dummy'})
