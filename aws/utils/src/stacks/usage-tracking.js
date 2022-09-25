import {RemovalPolicy, CfnOutput} from 'aws-cdk-lib'
import {LogGroup} from 'aws-cdk-lib/aws-logs'
import {SHARED_STACK_NAME} from './constants.js'

export const apiGatewayCloudwatchRoleRef = `${SHARED_STACK_NAME}-apiGatewayCloudWatchRoleArn`
export const applicationLogsBucketRef = `${SHARED_STACK_NAME}-applicationLogsBucketArn`
export const OUTPUT_PREFIX = 'USAGETRACKING'
export const USAGE_TYPE_LOG_GROUP = 'LogGroup'
export const USAGE_TYPE_CLOUDFRONT = 'CloudFront'

const standardLogFormat = '$context.identity.sourceIp,$context.httpMethod $context.path,$context.requestId'
const websocketLogFormat = '$context.identity.sourceIp,$context.eventType $context.routeKey,$context.requestId'

export function addUsageTrackingToHttpApi(httpApi) {
	//workaround for https://github.com/aws/aws-cdk/issues/11100
	httpApi.defaultStage.node.defaultChild.accessLogSettings = buildAccessLogSetting(httpApi, standardLogFormat)
}

export function addUsageTrackingToRestApi(restApi) {
	restApi.deploymentStage.node.defaultChild.accessLogSetting = buildAccessLogSetting(restApi, standardLogFormat)
}

export function addUsageTrackingToWebsocketStage(webSocketStage) {
	webSocketStage.node.defaultChild.accessLogSettings = buildAccessLogSetting(webSocketStage, websocketLogFormat)
}

function buildAccessLogSetting(parent, format) {
	const {stack} = parent
	const parentId = parent.node.id
	const logGroup = new LogGroup(stack, `${parentId}-AccessLogs`, {
		removalPolicy: RemovalPolicy.DESTROY
	})
	outputUsageStoreInfo(stack, parentId, logGroup.logGroupName, USAGE_TYPE_LOG_GROUP)
	const logSetting = {
		destinationArn: logGroup.logGroupArn,
		format: format
	}
	return logSetting
}

export function outputUsageStoreInfo(stack, name, source, type) {
	const usageOutputInfo = {
		name,
		source,
		type
	}
	new CfnOutput(stack, `${OUTPUT_PREFIX}${name}`, {value: JSON.stringify(usageOutputInfo)})
}
