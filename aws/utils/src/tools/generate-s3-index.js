import {strict as assert} from 'assert'
import {writeFile} from 'fs/promises'

import aws from 'aws-sdk'
aws.config.region = 'eu-west-2'
aws.config.apiVersions = {
	s3: '2006-03-01'
}

const s3 = new aws.S3()

export class IndexGenerator {
	#defaults = {
		folderIcon: '&#128449;',
		fileIcon: '&#128462;',
		openFileGenerator: this.#generateOpenFileHtml
	}

	#bucketName
	#basePath
	#options

	constructor(bucketName, basePath, options) {
		this.#bucketName = bucketName
		this.#basePath = basePath
		this.#options = {
			...this.#defaults,
			...options
		}
	}

	async upload(fileName, body, contentType) {
		let uploadResponse = await s3
			.upload({
				Bucket: this.#bucketName,
				Key: `${this.#basePath}/${fileName}`,
				Body: body,
				ContentType: contentType
			})
			.promise()
		assert.notEqual(uploadResponse.Location, null)
		assert.notEqual(uploadResponse.Location, undefined)
	}

	async #listPaths() {
		let response = await s3
			.listObjectsV2({
				Bucket: this.#bucketName,
				Prefix: this.#basePath
			})
			.promise()

		if (response.IsTruncated) {
			console.error(
				`More than ${response.MaxKeys} objects in bucket, you probably don't want to generate an index page for that.`
			)
			process.exit(2)
		}

		let keys = response.Contents.filter(({Key}) => !Key.endsWith('index.html')) //ignore any pre-existing index page
		console.log(`Building index of ${keys.length} files.`)
		let paths = {}
		keys.forEach(({Key: key}) => {
			let components = key.split('/')
			if (components[0] == this.#basePath) {
				components.splice(0, 1) //drop first element
			} else {
				components = ['..', ...components] //not really expected but at least means it won't blow up, and the '..' should make it obvious that something unexpected has happened
			}
			let directories = components.slice(0, components.length - 1)
			let currentPaths = paths
			directories.forEach(component => {
				if (!(component in currentPaths)) {
					currentPaths[component] = {}
				}
				currentPaths = currentPaths[component]
			})
			let file = components[components.length - 1]
			currentPaths[file] = key
		})
		return paths
	}

	#generateEntriesHtml(depth, folderPaths) {
		const htmlEntries = []
		Object.entries(folderPaths).forEach(([name, value]) => {
			if (typeof value === 'string') {
				htmlEntries.push(this.#generateFileHtml(depth, name, value))
			} else {
				htmlEntries.push(this.#generateFolderHtml(depth, name))
				htmlEntries.push(...this.#generateEntriesHtml(depth + 1, value))
			}
		})
		return htmlEntries
	}

	#indent(depth) {
		return '&nbsp'.repeat(depth * 3)
	}

	#generateFolderHtml(depth, name) {
		return `<div>${this.#indent(depth)}<span class="icon">${
			this.#options.folderIcon
		}</span>&nbsp;<span>${name}</span></div>`
	}

	#generateFileHtml(depth, name, filePath) {
		return `<div>${this.#indent(depth)}<a class="icon" download href="/${filePath}">${
			this.#options.fileIcon
		}</a>&nbsp;${this.#options.openFileGenerator(filePath, name)}</div>`
	}

	#generateOpenFileHtml(filePath, name) {
		return `<a href="/${filePath}">${name}</a>`
	}

	async #generateIndexPage() {
		const paths = await this.#listPaths()
		const snippets = this.#generateEntriesHtml(0, paths)

		let html = `<html>
		<head>
		<style>
		.icon {
			text-decoration: none; 
			color: black; 
			width: 23px;
			display: inline-block;
			text-align: center;
		}
		</style>
		</head>
		<body>
		${snippets.join('\n')}
		</body>
		</html>`
		return html
	}

	async updateIndexPage(localTestOutputFile) {
		let html = await this.#generateIndexPage()
		if (localTestOutputFile != null) {
			await writeFile(localTestOutputFile, html)
		} else {
			await this.upload('index.html', html, 'text/html')
		}
	}
}
