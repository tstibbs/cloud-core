import {fileURLToPath} from 'url'
import ejs from 'ejs'
import {readFile} from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)

//by default filePathForRelativeIncludes assumes everything is relative to the current script
export function renderTemplateContents(templateContents, vars, filePathForRelativeIncludes = __filename) {
	let template = ejs.render(templateContents, vars, {
		filename: filePathForRelativeIncludes
	})
	return template
}

export async function renderTemplateFromFile(templateFilePath, vars, filePathForRelativeIncludes = __filename) {
	let templateContents = await readFile(templateFilePath)
	return renderTemplateContents(templateContents, vars, filePathForRelativeIncludes)
}
