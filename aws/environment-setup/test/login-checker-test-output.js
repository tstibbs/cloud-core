export default [
	{
		user:
			'AssumedRole - arn:aws:sts::child-account-id-here:assumed-role/OrganizationAccountAccessRole/AllAccountAdminUser from arn:aws:iam::parent-account-id-here:user/AllAccountAdminUser',
		time: '2020-09-11T00:00:00Z',
		sourceIp: '1.2.3.4',
		userAgent: 'user-agent-here',
		account: 'child-account-id-here',
		sourceData: {
			eventSource: 'signin.amazonaws.com',
			eventType: 'AwsConsoleSignIn',
			eventName: 'SwitchRole',
			responseElements: {
				SwitchRole: 'Success'
			}
		}
	},
	{
		user: 'IAMUser - arn:aws:iam::parent-account-id-here:user/AllAccountAdminUser',
		time: '2020-09-11T00:00:00Z',
		sourceIp: '4.3.2.1',
		userAgent: 'user-agent-here',
		account: 'parent-account-id-here',
		sourceData: {
			eventSource: 'signin.amazonaws.com',
			eventType: 'AwsConsoleSignIn',
			eventName: 'ConsoleLogin',
			responseElements: {
				ConsoleLogin: 'Success'
			}
		}
	}
]
