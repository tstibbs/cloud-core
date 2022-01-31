import dotenv from 'dotenv'
dotenv.config()

export const {
	ALERTS_TOPIC,
	BUDGET,
	MAX_CREDENTIAL_AGE,
	MAX_UNUSED_CREDENTIAL_DAYS,
	NOTIFICATION_EMAIL,
	ORG_ID,
	PARENT_ACCOUNT_ID,
	MONITOR_TABLE_NAME
} = process.env

function split(input) {
	return input != null ? input.split(',') : []
}

export const RAW_CHILD_ACCOUNTS = process.env.CHILD_ACCOUNTS
export const CHILD_ACCOUNTS = split(RAW_CHILD_ACCOUNTS)

export const RAW_IP_RANGES = process.env.IP_RANGES
export const IP_RANGES = split(RAW_IP_RANGES)
