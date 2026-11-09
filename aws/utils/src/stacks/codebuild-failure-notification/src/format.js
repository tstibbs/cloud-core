export const CODEBUILD_NOTIFICATION_PREFIX = 'notification_text:'

export function printNotificationLog(message) {
	console.log(CODEBUILD_NOTIFICATION_PREFIX + JSON.stringify(message))
}
