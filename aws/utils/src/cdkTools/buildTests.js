import {strict as assert} from 'assert'
import {readFile as rawReadFile} from 'fs'
import {promisify} from 'util'
import {createRequire} from 'module'
import path from 'path'
const require = createRequire(import.meta.url)
const readFile = promisify(rawReadFile)

export async function validateBuiltAssets(stackName, expectedNumberOfAssets) {
	console.log(stackName)
	let assets = JSON.parse(await readFile(`./cdk.out/${stackName}.assets.json`))
	let zipAssets = Object.values(assets.files)
		.filter(file => file.source.packaging === 'zip')
		.map(file => file.source.path)
	let handlers = zipAssets
		.map(asset => `./cdk.out/${asset}/index.js`)
		.map(target => path.resolve(process.cwd(), target))
	handlers = handlers.map(asset => require(asset)).map(handler => handler.handler)
	assert.strictEqual(handlers.length, expectedNumberOfAssets)
	// check each exposes a function, that's all we can do without proper unit tests
	handlers.forEach(handler => assert.strictEqual(typeof handler, 'function'))
	//return the handlers for optional further testing
	return handlers
}
