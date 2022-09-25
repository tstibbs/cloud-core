export const MONITOR_STORE_SCHEMA = {
	PK: {name: 'pk', type: 'S'},
	OBJ: {name: 'obj', type: 'S'}
}

export const INFRA_ATHENA_WORKGROUP_NAME = 'infraMonitoring'
export const USAGE_CHILD_ROLE_NAME = 'usageMonitorDelegate' //the name of the role to assume in each child account
export const USAGE_PARENT_ROLE_NAME = 'usageMonitorRunner' //the name of the role that the lambda runs as
