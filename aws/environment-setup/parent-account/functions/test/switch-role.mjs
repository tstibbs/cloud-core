export default {
	eventVersion: '1.05',
	userIdentity: {
		type: 'AssumedRole',
		principalId: 'abcdef:AllAccountAdminUser',
		arn: 'arn:aws:sts::child-account-id-here:assumed-role/OrganizationAccountAccessRole/AllAccountAdminUser',
		accountId: 'child-account-id-here'
	},
	eventTime: '2020-09-11T00:00:00Z',
	eventSource: 'signin.amazonaws.com',
	eventName: 'SwitchRole',
	awsRegion: 'us-east-1',
	sourceIPAddress: '1.2.3.4',
	userAgent: 'user-agent-here',
	requestParameters: null,
	responseElements: {
		SwitchRole: 'Success'
	},
	additionalEventData: {
		SwitchFrom: 'arn:aws:iam::parent-account-id-here:user/AllAccountAdminUser',
		RedirectTo: 'https://s3.console.aws.amazon.com/s3/home?region\u003deu-west-2'
	},
	eventID: 'event-id-here',
	eventType: 'AwsConsoleSignIn',
	recipientAccountId: 'child-account-id-here'
}
