import {validateCdkAssets} from '../../../../index.js'
import {stackName} from './test-stack.js'

test('Assets are built as expected', async () => {
	//3 assets:
	//getItemUrls-handler
	//CustomS3AutoDeleteObjects
	//custom key generator
	await validateCdkAssets(stackName, 3)
})
