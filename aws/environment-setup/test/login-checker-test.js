import {strictEqual} from 'assert'
import input from './login-checker-test-input.js'
import expected from './login-checker-test-output.js'
import {processRecords} from '../src/loginChecker.js'

let actual = await processRecords(input)
//just snapshot testing really, but should at least catch any regressions
strictEqual(JSON.stringify(actual, null, 4), JSON.stringify(expected, null, 4))
