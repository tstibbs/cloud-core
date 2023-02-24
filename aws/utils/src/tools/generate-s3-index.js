import {writeFile} from 'fs/promises'

import {S3Sync} from './s3-sync.js'

export class IndexGenerator {
	#defaults = {
		folderIcon: 'fa-folder-open-o',
		fileIcon: 'fa-file-o',
		openFileGenerator: this.#generateOpenFileHtmlSnippet
	}
	#basePath
	#s3Sync
	#options

	constructor(localPath, bucketName, basePath, options) {
		this.#basePath = basePath
		this.#s3Sync = new S3Sync(bucketName, localPath, basePath)
		this.#options = {
			...this.#defaults,
			...options
		}
	}

	async upload(fileName, body, contentType) {
		await this.#s3Sync.upload(fileName, body, contentType)
	}

	async #listPaths() {
		let keys = await this.#s3Sync.listRemotePaths() //run lister again, so that even if parts of the sync failed, we still build an index page for the actual state
		keys = keys.filter(key => !key.endsWith('index.html')) //ignore any pre-existing index page
		console.log(`Building index of ${keys.length} files.`)
		let paths = {}
		keys.forEach(key => {
			let components = key.split('/')
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
				htmlEntries.push(this.#generateFileHtml(depth, name, `${this.#basePath}/${value}`))
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
		return `<div>${this.#indent(depth)}<span class="icon"><i class="fa fa-fw ${
			this.#options.folderIcon
		}" aria-hidden="true"></i></span>&nbsp;<span>${name}</span></div>`
	}

	#generateFileHtml(depth, name, filePath) {
		return `<div>${this.#indent(depth)}<a class="icon" download href="/${filePath}"><i class="fa fa-fw ${
			this.#options.fileIcon
		}" aria-hidden="true"></i></a>&nbsp;${this.#generateOpenFileHtml(filePath, name)}</div>`
	}

	#generateOpenFileHtml(filePath, name) {
		let snippet = this.#options.openFileGenerator(filePath, name)
		if (snippet === undefined) {
			//downstream code can trigger a fallback to the default method by returning 'undefined'
			snippet = this.#generateOpenFileHtmlSnippet(filePath, name)
		}
		return snippet
	}

	#generateOpenFileHtmlSnippet(filePath, name) {
		return `<a href="/${filePath}">${name}</a>`
	}

	async #generateIndexPage() {
		const paths = await this.#listPaths()
		const snippets = this.#generateEntriesHtml(0, paths)

		let html = `<html>
		<head>
		<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">
		<style>
		body {
			white-space: nowrap;
		}
		.icon {
			text-decoration: none; 
			color: black; 
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
		await this.#s3Sync.sync()
		let html = await this.#generateIndexPage()
		if (localTestOutputFile != null) {
			await writeFile(localTestOutputFile, html)
		} else {
			await this.upload('index.html', html, 'text/html')
		}
	}
}
