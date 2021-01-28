import {exec} from './utils.js'

export async function validate(templatePath) {
	try {
		await exec(`cfn-lint ${templatePath}`)
	} catch (error) {
		console.error(`validate failed for: ${templatePath}`)
		//I don't really know why node can't just print the full error output when an uncaught exception is thrown
		console.error(error)
		throw error
	}
}

export function validateWithExit(...paths) {
	let promises = paths.map(validate)
	//this is a dirty workaround until we can use node14 and await stuff at the top level
	return Promise.all(promises).catch(err => {
		console.log(err)
		process.exit(1)
	})
}
