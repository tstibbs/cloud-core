import ejs from 'ejs'
import {readFile} from 'fs/promises'

export function renderTemplateContents(templateContents, vars, filePathForRelativeIncludes) {
	let template = ejs.render(templateContents, vars, {
		filename: filePathForRelativeIncludes
	})
	return template
}

export async function renderTemplateFromFile(templateFilePath, vars) {
	let templateContents = (await readFile(templateFilePath)).toString()
	return renderTemplateContents(templateContents, vars, templateFilePath)
}

export function buildTemplateContentRenderingFunction(templateFilePath, vars) {
	return async ({htmlWebpackPlugin}) => await renderTemplateFromFile(templateFilePath, {...vars, htmlWebpackPlugin})
}
