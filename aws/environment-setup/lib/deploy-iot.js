import {Stack, Aws, Duration} from 'aws-cdk-lib'
import {CfnPolicy} from 'aws-cdk-lib/aws-iot'
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import {Runtime} from 'aws-cdk-lib/aws-lambda'
import {Rule, Schedule} from 'aws-cdk-lib/aws-events'
import eventsTargets from 'aws-cdk-lib/aws-events-targets'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'

import {buildMonitorStore} from './deploy-parent-tooling.js'
import {buildNotificationChannels} from './deploy-shared.js'

export class IotStack extends Stack {
	constructor(scope, id, props) {
		super(scope, id, props)

		new CfnPolicy(this, 'uptimeMonitoringThingPolicy', {
			policyDocument: {
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: 'iot:Connect',
						Resource: `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:client/\${iot:Connection.Thing.ThingName}`
					}
				]
			},
			policyName: `${Aws.STACK_NAME}-uptimeMonitoringThingPolicy`
		})

		let monitorStoreTable = buildMonitorStore(this)
		let notificationTopic = buildNotificationChannels(this)

		let uptimeCheckerFunction = new NodejsFunction(this, 'uptimeCheckerFunction', {
			entry: 'src/uptime-checker.js',
			environment: {
				ALERTS_TOPIC: notificationTopic.topicArn,
				MONITOR_TABLE_NAME: monitorStoreTable.tableName
			},
			memorySize: 128,
			timeout: Duration.minutes(1),
			runtime: Runtime.NODEJS_16_X,
			initialPolicy: [
				new PolicyStatement({
					actions: ['iot:SearchIndex'],
					resources: [`arn:${Aws.PARTITION}:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:index/AWS_Things`]
				})
			]
		})
		monitorStoreTable.grantReadWriteData(uptimeCheckerFunction)
		notificationTopic.grantPublish(uptimeCheckerFunction)

		new Rule(this, 'toolingFunctionSchedule', {
			schedule: Schedule.cron({minute: '0', hour: '*/6'}), //every six hours
			targets: [
				new eventsTargets.LambdaFunction(uptimeCheckerFunction, {
					retryAttempts: 1
				})
			]
		})
	}
}

/*
now run the following:

aws iot create-thing-group --thing-group-name 'uptime-monitoring'
aws iot create-thing-type --thing-type-name 'mini-pc'
aws iot update-indexing-configuration --thing-indexing-configuration '{
	"thingIndexingMode": "REGISTRY",
	"thingConnectivityIndexingMode": "STATUS"
}'
*/

/*
when adding a new thing:

https://eu-west-2.console.aws.amazon.com/iot/home?region=eu-west-2#/create/provisioning
make sure to add to thing type and thing group, and choose the policy "uptimeMonitoringThingPolicy"
select 'Auto-generate a new certificate (recommended)'
download all the stuff
*/
