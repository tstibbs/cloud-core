import {RemovalPolicy} from 'aws-cdk-lib'
import {LogGroup} from 'aws-cdk-lib/aws-logs'

export const apiGatewayCloudwatchRoleRef = `AllAccountsStack-apiGatewayCloudWatchRoleArn`
export const applicationLogsBucketRef = `AllAccountsStack-applicationLogsBucketArn`

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
	return {
		destinationArn: logGroup.logGroupArn,
		format: format
	}
}
