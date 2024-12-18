//workarounds for drift detection false-positives - i.e. check if it looks like one of the false positives and ignore if so
//optional for the future - extract the info from the expected value and validate it using the API (really shouldn't have to do this!)

function isApiGatewayNullBody(drift) {
	// https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/791
	return (
		drift.ResourceType == 'AWS::ApiGatewayV2::Api' &&
		drift.PropertyDifferences.every(diff => diff.PropertyPath == '/Body' && diff.ActualValue == 'null')
	)
}

function isApiGatewayNullProps(drift) {
	return (
		drift.ResourceType == 'AWS::ApiGatewayV2::Integration' &&
		drift.PropertyDifferences.every(diff => diff.ActualValue == 'null') &&
		drift.PropertyDifferences.every(diff =>
			['/PayloadFormatVersion', '/IntegrationUri', '/IntegrationType'].includes(diff.PropertyPath)
		)
	)
}

function isScheduleRetryPolicy(drift) {
	// https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/956
	return (
		drift.ResourceType == 'AWS::Events::Rule' &&
		drift.PropertyDifferences.every(
			diff =>
				/\/Targets\/\d+\/RetryPolicy/.test(diff.PropertyPath) &&
				/{"MaximumRetryAttempts":\d+}/.test(diff.ExpectedValue) &&
				diff.ActualValue == 'null'
		)
	)
}

function isMissingTags(drift) {
	//tags set in cloudformation are often not detected on the resource by drift detection e.g. https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/901
	return drift.PropertyDifferences.every(diff => diff.PropertyPath == '/Tags' && diff.ActualValue == 'null')
}

export function diffsAreAcceptable(drifts) {
	let unacceptable = drifts.filter(
		drift =>
			!isMissingTags(drift) &&
			!isApiGatewayNullBody(drift) &&
			!isScheduleRetryPolicy(drift) &&
			!isApiGatewayNullProps(drift)
	)
	unacceptable.forEach(drift => console.log(drift))
	return unacceptable.length == 0
}
