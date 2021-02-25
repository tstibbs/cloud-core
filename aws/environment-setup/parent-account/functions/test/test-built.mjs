import {strictEqual} from 'assert'

import switchRoleEvent from './switch-role.mjs'
import consoleLoginEvent from './console-login.mjs'
import loginChecker from '../dist/loginChecker.js'
import cfnStackDriftChecker from '../dist/cfnStackDriftChecker.js'

await loginChecker.processRecords({Records: [switchRoleEvent, consoleLoginEvent]}).then(data => console.log(data))

//check it exposes a function, that's all we can do without proper unit tests
strictEqual(typeof loginChecker.handler, 'function')
strictEqual(typeof cfnStackDriftChecker.handler, 'function')
