import {Template} from 'aws-cdk-lib/assertions'

function checkStackClearsUp(synthed) {
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

//it's possible to express some things in such a way that they will flag as drift in cloudformation, so we check for known examples of this
function checkDriftDetectionCompatible(synthed) {
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

function checkEncryption(synthed) {
	let resources = Object.entries(synthed.Resources).filter(([id, resource]) => resource.Type == 'AWS::S3::Bucket')
	if (resources.length > 0) {
		describe.each(resources)('all buckets have encryption', (id, resource) => {
			test(`'${id}' has encryption`, () => {
				let sseConfigs = resource.Properties?.BucketEncryption?.ServerSideEncryptionConfiguration
				expect(sseConfigs).toBeDefined()
				expect(sseConfigs.some(sseConfig => sseConfig.ServerSideEncryptionByDefault?.SSEAlgorithm === 'AES256')).toBe(
					true
				)
				//if this fails, adding this is usually sufficient: `encryption: BucketEncryption.S3_MANAGED`
			})
		})
	}
}

function checkNoSecretsManager(synthed) {
	//secrets manager is unreasonably expensive, so we don't want to use it
	test(`no secrets manager`, () => {
		let resources = Object.values(synthed.Resources).filter(resource => resource.Type == 'AWS::SecretsManager::Secret')
		expect(resources.length).toEqual(0)
	})
}

export function checkAllStackPolicies(stack) {
	describe(stack.artifactId, () => {
		let synthed = Template.fromStack(stack).toJSON()
		if (synthed.Resources != null) {
			checkStackClearsUp(synthed)
			checkDriftDetectionCompatible(synthed)
			checkEncryption(synthed)
			checkNoSecretsManager(synthed)
		}
	})
}

export function checkAllPoliciesForMultipleStacks(stacks) {
	stacks.forEach(checkAllStackPolicies)
}
