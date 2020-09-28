import AWS from 'aws-sdk'

import {readFile} from './utils.js'

const cloudformation = new AWS.CloudFormation({apiVersion: '2010-05-15'})

export async function validate(templatePath) {
	let templateBody = await readFile(templatePath, {encoding: 'utf-8'})
	let params = {
		TemplateBody: templateBody
	}
	await cloudformation.validateTemplate(params).promise() // will error if template doesn't validate
}
