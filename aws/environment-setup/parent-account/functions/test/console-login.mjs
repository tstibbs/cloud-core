export default {
	eventVersion: '1.05',
	userIdentity: {
		type: 'IAMUser',
		principalId: 'ghijk',
		arn: 'arn:aws:iam::parent-account-id-here:user/AllAccountAdminUser',
		accountId: 'parent-account-id-here',
		userName: 'AllAccountAdminUser'
	},
	eventTime: '2020-09-11T00:00:00Z',
	eventSource: 'signin.amazonaws.com',
	eventName: 'ConsoleLogin',
	awsRegion: 'us-east-1',
	sourceIPAddress: '4.3.2.1',
	userAgent: 'user-agent-here',
	requestParameters: null,
	responseElements: {
		ConsoleLogin: 'Success'
	},
	additionalEventData: {
		LoginTo: 'https://console.aws.amazon.com/console/home?state=hashArgs%23&isauthcode=true',
		MobileVersion: 'No',
		MFAUsed: 'Yes'
	},
	eventID: 'event-id-here',
	eventType: 'AwsConsoleSignIn',
	recipientAccountId: 'parent-account-id-here'
}
