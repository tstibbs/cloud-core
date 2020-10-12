import {exec} from './utils.js'

export async function validate(templatePath) {
	try {
		await exec(`cfn-lint ${templatePath}`)
	} catch (error) {
		//I don't really know why node can't just print the full error output when an uncaught exception is thrown
		console.error(error)
		throw error
	}
}
