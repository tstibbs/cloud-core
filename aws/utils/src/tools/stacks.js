import {CloudFormationClient, DescribeStackResourceCommand, GetTemplateCommand} from '@aws-sdk/client-cloudformation'

const client = new CloudFormationClient()

export async function findPhysicalIdForCdkPath(stackName, cdkPath) {
	cdkPath = `${stackName}/${cdkPath}`

	// 1. Fetch the template to inspect metadata
	const templateCommand = new GetTemplateCommand({StackName: stackName})
	const {TemplateBody} = await client.send(templateCommand)
	const template = JSON.parse(TemplateBody)

	// 2. Find the logical ID whose Metadata['aws:cdk:path'] matches the provided cdkPath
	const logicalIds = Object.entries(template.Resources)
		.filter(([_, resource]) => resource?.Metadata?.['aws:cdk:path'] == cdkPath)
		.map(([logicalId, _]) => logicalId)

	if (logicalIds.length === 0) {
		throw new Error(`No resource in template had aws:cdk:path matching '${cdkPath}'`)
	}
	if (logicalIds.length > 1) {
		throw new Error(`Multiple logical IDs matched aws:cdk:path '${cdkPath}': ${matches.join(', ')}.`)
	}

	const logicalId = logicalIds[0]

	// 3. Use DescribeStackResourceCommand to get the PhysicalResourceId for that logical id
	const describeCmd = new DescribeStackResourceCommand({StackName: stackName, LogicalResourceId: logicalId})
	const res = await client.send(describeCmd)
	const physicalId = res.StackResourceDetail?.PhysicalResourceId
	if (!physicalId) throw new Error(`Unable to determine PhysicalResourceId for logical id '${logicalId}'`)
	return physicalId
}
