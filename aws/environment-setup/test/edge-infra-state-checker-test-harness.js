import assert from 'assert'
import {aws} from '../src/auth-utils.js'
import {CURRENT_ACCOUNT, TABLE_NAME} from '../lib/deploy-envs.js'
import {assumeRole} from '../src/auth-utils.js'
import {INFRA_TRACKING_SCHEMA} from '../../../edge/infra-tracking/app/constants.js'
import {writeItemEntry} from '../../../edge/infra-tracking/app/utils.js'
const {PK} = INFRA_TRACKING_SCHEMA
const dayInMillis = 24 * 60 * 60 * 1000
const testPk = 'test-device-001'
const dynamoDb = new aws.DynamoDB()

await assumeRole(`arn:aws:iam::${CURRENT_ACCOUNT}:role/infraStateCheckerFunctionsRole`)
let {getProblemDevices} = await import('../src/edge-infra-state-checker.js')

let problemDevices = await getProblemDevices()
assert.strictEqual(problemDevices.length, 0, 'Should be no problem devices')

await writeItem(Date.now() - 2 * dayInMillis) // represents old check in
problemDevices = await getProblemDevices()
assert.strictEqual(problemDevices.length, 1, 'Device has old check-in so should be returned as problem device.')

await writeItem(Date.now()) // updating to newer timestamp
problemDevices = await getProblemDevices()
assert.strictEqual(
	problemDevices.length,
	0,
	'Device has up-to-date check-in so should not be returned as problem device.'
)

await deleteItem()

async function writeItem(timestamp) {
	await writeItemEntry(dynamoDb, TABLE_NAME, testPk, timestamp)
}

async function deleteItem() {
	let params = {
		TableName: TABLE_NAME,
		Key: {
			[PK.name]: {
				[PK.type]: testPk
			}
		}
	}
	await dynamoDb.deleteItem(params).promise()
}
