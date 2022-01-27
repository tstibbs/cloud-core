import aws from 'aws-sdk'
import {writeItemEntry} from './utils.js'

aws.config.logger = console
aws.config.loadFromPath(process.env.AWS_CREDENTIALS_FILE)
const dynamoDb = new aws.DynamoDB({apiVersion: '2012-08-10'})

const deviceId = process.env.DEVICE_ID
const tableName = process.env.TABLE_NAME

const SIX_HOURS_IN_MILLIS = 6 * 60 * 60 * 1000

async function run() {
	setInterval(checkIn, SIX_HOURS_IN_MILLIS)
}

async function checkIn() {
	await writeItemEntry(dynamoDb, tableName, deviceId, Date.now())
}

export {run, checkIn}
