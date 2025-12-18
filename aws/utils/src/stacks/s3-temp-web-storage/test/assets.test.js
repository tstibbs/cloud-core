import {validateCdkAssets} from '../../../../index.js'
import {buildStack} from './test-stack.js'

test('Assets are built as expected', async () => {
	//3 assets:
	//getItemUrls-handler
	//CustomS3AutoDeleteObjects
	//custom key generator
	await validateCdkAssets(buildStack, 3)
})
