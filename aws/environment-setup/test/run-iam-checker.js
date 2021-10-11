import '../lib/deploy-envs.js'
import {handler} from '../src/iam-checker.js'

await handler({}, {awsRequestId: 'dummy'})
