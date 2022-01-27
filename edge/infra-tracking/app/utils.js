import {INFRA_TRACKING_SCHEMA} from './constants.js'
const {PK, SK} = INFRA_TRACKING_SCHEMA

export async function writeItemEntry(dynamoDb, tableName, deviceId, timestamp) {
	let params = {
		ExpressionAttributeNames: {
			'#date': SK.name
		},
		ExpressionAttributeValues: {
			':date': {
				[SK.type]: `${timestamp}`
			}
		},
		Key: {
			[PK.name]: {
				[PK.type]: deviceId
			}
		},
		TableName: tableName,
		UpdateExpression: 'SET #date = :date'
	}
	await dynamoDb.updateItem(params).promise()
}
