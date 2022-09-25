import {Aws} from 'aws-cdk-lib'
import {
	ManagedPolicy,
	Role,
	CompositePrincipal,
	PolicyDocument,
	ServicePrincipal,
	ArnPrincipal,
	PolicyStatement
} from 'aws-cdk-lib/aws-iam'
import sns from 'aws-cdk-lib/aws-sns'
import snsSubs from 'aws-cdk-lib/aws-sns-subscriptions'
import {NOTIFICATION_EMAIL, CHILD_ACCOUNTS, DEV_SUFFIX} from './deploy-envs.js'

export function buildNotificationChannels(stack) {
	const notificationTopic = new sns.Topic(stack, 'notificationTopic')
	notificationTopic.addSubscription(new snsSubs.EmailSubscription(NOTIFICATION_EMAIL))
	return notificationTopic
}

export const PARENT_ACCNT_CLI_ROLE_NAME = `ParentAccountCliRole${DEV_SUFFIX}`

export function createMultiAccountLambdaRole(stack, roleName, childAccountRoleName) {
	const lambdaBasicPolicy = ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
	const role = new Role(stack, roleName, {
		roleName: roleName,
		assumedBy: new CompositePrincipal(
			new ServicePrincipal('lambda.amazonaws.com', {
				assumeRoleAction: 'sts:AssumeRole'
			}),
			new ArnPrincipal(`arn:aws:iam::${Aws.ACCOUNT_ID}:role/${PARENT_ACCNT_CLI_ROLE_NAME}`) //to make local dev easier
		),
		inlinePolicies: {
			delegatingPolicy: new PolicyDocument({
				statements: [
					new PolicyStatement({
						actions: ['sts:AssumeRole'],
						resources: CHILD_ACCOUNTS.map(account => `arn:aws:iam::${account}:role/${childAccountRoleName}`)
					})
				]
			})
		},
		managedPolicies: [lambdaBasicPolicy]
	})
	return role
}
