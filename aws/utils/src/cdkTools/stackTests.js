import {Template} from 'aws-cdk-lib/assertions'

function checkStackClearsUp(synthed) {
	if (synthed.Resources != null) {
		let resources = Object.entries(synthed.Resources)
		if (resources.length > 0)
			describe.each(resources)(`no resources have 'retain' or 'snapshot' deletion policies`, (id, resource) => {
				test(`'${id}' has empty or 'delete' deletion/replace policy`, () => {
					expect(resource.DeletionPolicy == undefined || resource.DeletionPolicy == 'Delete').toBe(true)
					expect(resource.UpdateReplacePolicy == undefined || resource.UpdateReplacePolicy == 'Delete').toBe(true)
					//if this test fails, adding the following is usually sufficient: `removalPolicy: cdk.RemovalPolicy.DESTROY`
				})
			})
	}
}

//it's possible to express some things in such a way that they will flag as drift in cloudformation, so we check for known examples of this
function checkDriftDetectionCompatible(synthed) {
	if (synthed.Resources != null) {
		let resources = Object.entries(synthed.Resources).filter(
			([id, resource]) => resource.Type == 'AWS::IAM::ManagedPolicy'
		)
		if (resources.length > 0) {
			describe.each(resources)(
				'all managed policies have descriptions to prevent false drift detections',
				(id, resource) => {
					test(`'${id}' has description`, () => {
						expect(resource.Properties.Description).toMatch(/.+/)
					})
				}
			)
		}
	}
}

export function checkAllStackPolicies(stack) {
	describe(stack.artifactId, () => {
		let synthed = Template.fromStack(stack).toJSON()
		checkStackClearsUp(synthed)
		checkDriftDetectionCompatible(synthed)
	})
}

export function checkAllPoliciesForMultipleStacks(stacks) {
	stacks.forEach(checkAllStackPolicies)
}
