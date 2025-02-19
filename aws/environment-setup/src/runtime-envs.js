import dotenv from 'dotenv'
dotenv.config()

export const {
	ALERTS_TOPIC,
	WARNING_BUDGET,
	MAX_BUDGET,
	MAX_CREDENTIAL_AGE,
	NOTIFICATION_EMAIL,
	ORG_ID,
	PARENT_ACCOUNT_ID,
	MONITOR_TABLE_NAME,
	ATHENA_WORKGROUP_NAME,
	IP_INFO_TOKEN
} = process.env

function split(input) {
	return input != null ? input.split(',') : []
}

export const RAW_CHILD_ACCOUNTS = process.env.CHILD_ACCOUNTS
export const CHILD_ACCOUNTS = split(RAW_CHILD_ACCOUNTS)

export const RAW_IP_RANGES = process.env.IP_RANGES
export const IP_RANGES = split(RAW_IP_RANGES)

export const RAW_USAGE_MONITOR_EVENT_AGE_DAYS = process.env.USAGE_MONITOR_EVENT_AGE_DAYS
export const USAGE_MONITOR_EVENT_AGE_DAYS = parseInt(RAW_USAGE_MONITOR_EVENT_AGE_DAYS)

export const RAW_USAGE_HIGH_RISK_COUNTRIES = process.env.USAGE_HIGH_RISK_COUNTRIES
export const USAGE_HIGH_RISK_COUNTRIES = split(RAW_USAGE_HIGH_RISK_COUNTRIES)

export const RAW_USAGE_MY_COUNTRY_CODES = process.env.USAGE_MY_COUNTRY_CODES
export const USAGE_MY_COUNTRY_CODES = split(RAW_USAGE_MY_COUNTRY_CODES)
