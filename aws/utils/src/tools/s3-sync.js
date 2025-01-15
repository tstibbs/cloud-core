/* Syncs a local directory structure *to* an S3 bucket (one way sync). Not intended for large numbers of files. */
import {strict as assert} from 'assert'
import {relative} from 'path'
import {readFile} from 'fs/promises'

import {list} from 'recursive-readdir-async'
import {S3} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'

import {defaultAwsClientConfig} from './aws-client-config.js'

const s3 = new S3(defaultAwsClientConfig)

const INCLUDE_SUFFIXES = 'include-suffixes'
const EXCLUDE_SUFFIXES = 'exclude-suffixes'

export class S3Sync {
	#bucketName
	#localPath
	#subDirectoryPath
	#toDelete
	#toUpload
	#includeSuffixes
	#excludeSuffixes

	constructor(bucketName, localPath, subDirectoryPath, yargv = {}) {
		this.#bucketName = bucketName
		this.#localPath = localPath
		this.#subDirectoryPath = subDirectoryPath
		this.#includeSuffixes = yargv[INCLUDE_SUFFIXES]
		this.#excludeSuffixes = yargv[EXCLUDE_SUFFIXES]
	}

	async upload(fileName, body, contentType) {
		let uploadResponse = await new Upload({
			client: s3,
			params: {
				Bucket: this.#bucketName,
				Key: `${this.#subDirectoryPath}/${fileName}`,
				Body: body,
				ContentType: contentType
			}
		}).done()
		assert.notEqual(uploadResponse.Location, null)
		assert.notEqual(uploadResponse.Location, undefined)
	}

	async listRemotePaths() {
		let response = await s3.listObjectsV2({
			Bucket: this.#bucketName,
			Prefix: this.#subDirectoryPath
		})

		if (response.IsTruncated) {
			console.error(
				`More than ${response.MaxKeys} objects in bucket, you probably don't want to generate an index page for that.`
			)
			process.exit(2)
		}
		let keys = response.Contents.map(({Key}) => Key).sort()
		let objectsOutsideOfSubDirPath = keys.filter(key => !key.startsWith(this.#subDirectoryPath))
		if (objectsOutsideOfSubDirPath.length > 0) {
			throw new Error(
				`keys returned that weren't within prefix path specified: ${objectsOutsideOfSubDirPath.join(',')}`
			)
		}
		keys = keys
			.map(key => key.substring(this.#subDirectoryPath.length + 1))
			.filter(file => this.#includeSuffixes == null || this.#suffixMatches(file, this.#includeSuffixes))
			.filter(file => this.#excludeSuffixes == null || !this.#suffixMatches(file, this.#excludeSuffixes))
		return keys
	}

	async listLocalPaths() {
		let files = await list(this.#localPath)
		assert.equal(files.error, undefined)
		files = files
			.map(file => file.fullname)
			.filter(file => this.#includeSuffixes == null || this.#suffixMatches(file, this.#includeSuffixes))
			.filter(file => this.#excludeSuffixes == null || !this.#suffixMatches(file, this.#excludeSuffixes))
			.map(file => relative(this.#localPath, file))
			.sort()
		return files
	}

	#suffixMatches(file, suffixes) {
		return suffixes.some(suf => file.endsWith(suf))
	}

	async runCompare() {
		let remote = await this.listRemotePaths()
		let local = await this.listLocalPaths()
		//comparison method has high complexity, assumes order of 100s of files.
		this.#toDelete = remote
			.filter(path => !local.includes(path))
			//don't delete the index.html that we're just about to generate
			.filter(path => path != 'index.html')
		this.#toUpload = local.filter(path => !remote.includes(path))
		let toIgnore = local.filter(path => remote.includes(path))
		console.log(`toDelete: ${this.#toDelete.length}; toUpload: ${this.#toUpload.length}; toIgnore: ${toIgnore.length}`)
	}

	async syncAdds() {
		for (let path of this.#toUpload) {
			let localPath = `${this.#localPath}/${path}`
			let fileContents = await readFile(localPath)
			await this.upload(path, fileContents, 'application/pdf') //TODO content type
		}
	}

	async syncDeletes() {
		if (this.#toDelete.length > 0) {
			let objectsToDelete = this.#toDelete.map(path => ({
				Key: `${this.#subDirectoryPath}/${path}`
			}))
			let params = {
				Bucket: this.#bucketName,
				Delete: {
					Objects: objectsToDelete
				}
			}
			await s3.deleteObjects(params)
		}
	}

	async sync() {
		await this.runCompare()
		await this.syncAdds()
		await this.syncDeletes()
	}

	static buildYargs(yargsInstance) {
		return yargsInstance
			.option(INCLUDE_SUFFIXES, {
				describe: 'If specified, only sync files with one of these suffixes',
				type: 'array'
			})
			.option(EXCLUDE_SUFFIXES, {
				describe: "If specified, don't sync files with any of these suffixes",
				type: 'array'
			})
	}
}
