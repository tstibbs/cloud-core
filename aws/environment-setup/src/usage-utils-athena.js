import backOff from 'exponential-backoff'

import {assertNotPaging} from './utils.js'

import {INFRA_ATHENA_WORKGROUP_NAME} from './constants.js'

function safeTableName(tableName) {
	tableName = tableName.toLowerCase()
	tableName = tableName.replaceAll(/[^a-z_0-9]/g, '__')
	return tableName
}

function buildCreateTableStatement_CloudFront(tableName, bucket, stack, resourceName) {
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

function buildCreateTableStatement_S3AccessLogs(tableName, bucket, stack, resourceName) {
	return `CREATE EXTERNAL TABLE IF NOT EXISTS \`default.${safeTableName(tableName)}\` (
		bucketowner STRING, 
		bucket_name STRING, 
		requestdatetime STRING, 
		remoteip STRING, 
		requester STRING, 
		requestid STRING, 
		operation STRING, 
		key STRING, 
		request_uri STRING, 
		httpstatus STRING, 
		errorcode STRING, 
		bytessent BIGINT, 
		objectsize BIGINT, 
		totaltime STRING, 
		turnaroundtime STRING, 
		referrer STRING, 
		useragent STRING, 
		versionid STRING, 
		hostid STRING, 
		sigv STRING, 
		ciphersuite STRING, 
		authtype STRING, 
		endpoint STRING, 
		tlsversion STRING,
		accesspointarn STRING,
		aclrequired STRING)
	  ROW FORMAT SERDE 
		'org.apache.hadoop.hive.serde2.RegexSerDe' 
	  WITH SERDEPROPERTIES ( 
		'input.regex'='([^ ]*) ([^ ]*) \\\\[(.*?)\\\\] ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) (\\"[^\\"]*\\"|-) (-|[0-9]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) (\\"[^\\"]*\\"|-) ([^ ]*)(?: ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*))?.*$') 
	  STORED AS INPUTFORMAT 
		'org.apache.hadoop.mapred.TextInputFormat' 
	  OUTPUTFORMAT 
		'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
	  LOCATION
		's3://${bucket}/${stack}/${resourceName}/'
	  `
}

export async function initialiseAthena_CloudFront(athena, tableName, bucket, stack, resourceName) {
	let sql = buildCreateTableStatement_CloudFront(tableName, bucket, stack, resourceName)
	return await executeAthenaQuery(athena, sql)
}

export async function initialiseAthena_S3AccessLogs(athena, tableName, bucket, stack, resourceName) {
	let sql = buildCreateTableStatement_S3AccessLogs(tableName, bucket, stack, resourceName)
	return await executeAthenaQuery(athena, sql)
}

export async function queryAthena_CloudFront(athena, tableName, startDate, endDate) {
	let sql = `SELECT count(*) as count, *  from (
		select status, date, request_ip, method, IF(x_edge_detailed_result_type = 'ClientGeoBlocked', 'GeoBlocked') as geoBlocked, regexp_extract(uri, '^/?([^/]+)/', 1) as uriRoot
		FROM default.${safeTableName(tableName)}
		WHERE "date" BETWEEN DATE '${startDate}' AND DATE '${endDate}'
		and uri != '/favicon.ico'
	)
	group by status, date, request_ip, geoBlocked, method, uriRoot`
	return await executeAthenaQuery(athena, sql)
}

export async function queryAthena_S3AccessLogs(athena, tableName, startDate, endDate) {
	let sql = `SELECT count(*) as count, * from (
		select * from (
			select 
				httpstatus as status, 
				CAST(parse_datetime(requestdatetime, 'dd/MMM/yyyy:HH:mm:ss Z' ) AS date) as date, 
				remoteip as request_ip,
				operation as method
			from default.${safeTableName(tableName)}
			where authtype = 'QueryString'
		)
		where "date" BETWEEN DATE '${startDate}' AND DATE '${endDate}'
	)
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
		startingDelay: 2 * 1000, // 2 seconds
		retry: e => {
			if (e.message.endsWith('Final query state: FAILED')) {
				console.error('aborting retry, query has already failed.')
				return false
			} else {
				return true
			}
		}
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
