import {validateCdkAssets} from '../../../../index.js'
import {stackName} from './test-stack.js'

test('Assets are built as expected', async () => {
	//2 assets:
	//getItemUrls-handler
	//CustomS3AutoDeleteObjects
	await validateCdkAssets(stackName, 2)
})
