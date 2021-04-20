import cdk from '@aws-cdk/core'
import {buildAwsConfigStack} from './deploy-parent-awsconfig.js'
import {buildAccountSetupStack} from './deploy-parent-setup.js'
import {buildAccountMonitoring} from './deploy-parent-monitoring.js'
import {buildNotificationChannels, tagAllLambdasWithRevision} from './deploy-shared.js'

class ParentStack extends cdk.Stack {
	constructor(scope, id, props) {
		super(scope, id, props)
		const notificationTopic = buildNotificationChannels(this)
		buildAwsConfigStack(this, notificationTopic)
		buildAccountSetupStack(this, notificationTopic)
		buildAccountMonitoring(this, notificationTopic)
		tagAllLambdasWithRevision(this)
	}
}

export {ParentStack}
