import {handler} from '../src/emergency-tear-down.js'

//running this would tear down all stacks in the current account - set termination protection on anything that shouldn't be torn down
await handler({}, {awsRequestId: 'dummy'})
