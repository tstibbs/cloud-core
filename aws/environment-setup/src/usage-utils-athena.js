import backOff from 'exponential-backoff'

import {assertNotPaging} from './utils.js'

import {INFRA_ATHENA_WORKGROUP_NAME} from './constants.js'

function safeTableName(tableName) {
	tableName = tableName.toLowerCase()
	tableName = tableName.replaceAll(/[^a-z_0-9]/g, '__')
	return tableName
}

function buildCreateTableStatement(tableName, bucket, stack, resourceName) {
	return `CREATE EXTERNAL TABLE IF NOT EXISTS \`default.${safeTableName(tableName)}\` (
		\`date\` DATE,
		time STRING,
		location STRING,
		bytes BIGINT,
		request_ip STRING,
		method STRING,
		host STRING,
		uri STRING,
		status INT,
		referrer STRING,
		user_agent STRING,
		query_string STRING,
		cookie STRING,
		result_type STRING,
		request_id STRING,
		host_header STRING,
		request_protocol STRING,
		request_bytes BIGINT,
		time_taken FLOAT,
		xforwarded_for STRING,
		ssl_protocol STRING,
		ssl_cipher STRING,
		response_result_type STRING,
		http_version STRING,
		fle_status STRING,
		fle_encrypted_fields INT,
		c_port INT,
		time_to_first_byte FLOAT,
		x_edge_detailed_result_type STRING,
		sc_content_type STRING,
		sc_content_len BIGINT,
		sc_range_start BIGINT,
		sc_range_end BIGINT
	)
	ROW FORMAT DELIMITED 
	FIELDS TERMINATED BY '\\t'
	LOCATION 's3://${bucket}/${stack}/${resourceName}/'
	TBLPROPERTIES ( 'skip.header.line.count'='2' )`
}

export async function initialiseAthena(athena, tableName, bucket, stack, resourceName) {
	let sql = buildCreateTableStatement(tableName, bucket, stack, resourceName)
	return await executeAthenaQuery(athena, sql)
}

export async function queryAthena(athena, tableName, startDate, endDate) {
	let sql = `SELECT status, date, request_ip, method, count(*) as count
	FROM default.${safeTableName(tableName)}
	WHERE "date" BETWEEN DATE '${startDate}' AND DATE '${endDate}'
	and uri != '/favicon.ico'
	group by status, date, request_ip, method`
	return await executeAthenaQuery(athena, sql)
}

async function executeAthenaQuery(athena, sql) {
	//initiate query
	var params = {
		QueryString: sql,
		WorkGroup: INFRA_ATHENA_WORKGROUP_NAME
	}
	let startResults = await athena.startQueryExecution(params).promise()
	let executionId = startResults.QueryExecutionId

	//keep checking the status of the query until it's completed
	const backoffParams = {
		maxDelay: 60 * 1000, // 1 minute
		startingDelay: 2 * 1000 // 2 seconds
	}
	const checkForCompletion = async () => {
		//will throw an error if the results are not ready, causing the backoff to retry
		console.log(`Checking results of query ${executionId}`)
		let queryResponse = await athena
			.getQueryResults({
				QueryExecutionId: executionId
			})
			.promise()
		assertNotPaging(queryResponse)
		return queryResponse
	}
	let endResults = await backOff.backOff(checkForCompletion, backoffParams)
	return endResults
}
