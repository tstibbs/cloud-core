/* Syncs a local directory structure *to* an S3 bucket (one way sync). Not intended for large numbers of files. */
import {strict as assert} from 'assert'
import {relative} from 'path'
import {readFile} from 'fs/promises'

import {list} from 'recursive-readdir-async'

import aws from 'aws-sdk'
aws.config.region = 'eu-west-2'
aws.config.apiVersions = {
	s3: '2006-03-01'
}

const s3 = new aws.S3()

export class S3Sync {
	#bucketName
	#localPath
	#subDirectoryPath
	#toDelete
	#toUpload

	constructor(bucketName, localPath, subDirectoryPath) {
		this.#bucketName = bucketName
		this.#localPath = localPath
		this.#subDirectoryPath = subDirectoryPath
	}

	async upload(fileName, body, contentType) {
		let uploadResponse = await s3
			.upload({
				Bucket: this.#bucketName,
				Key: `${this.#subDirectoryPath}/${fileName}`,
				Body: body,
				ContentType: contentType
			})
			.promise()
		assert.notEqual(uploadResponse.Location, null)
		assert.notEqual(uploadResponse.Location, undefined)
	}

	async listRemotePaths() {
		let response = await s3
			.listObjectsV2({
				Bucket: this.#bucketName,
				Prefix: this.#subDirectoryPath
			})
			.promise()

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
		keys = keys.map(key => key.substring(this.#subDirectoryPath.length + 1))
		return keys
	}

	async listLocalPaths() {
		let files = await list(this.#localPath)
		assert.equal(files.error, undefined)
		files = files
			.map(file => file.fullname)
			.map(file => relative(this.#localPath, file))
			.sort()
		return files
	}

	async runCompare() {
		let remote = await this.listRemotePaths()
		let local = await this.listLocalPaths()
		//comparison method has high complexity, assumes order of 100s of files.
		this.#toDelete = remote.filter(path => !local.includes(path))
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
			await s3.deleteObjects(params).promise()
		}
	}

	async sync() {
		await this.runCompare()
		await this.syncAdds()
		await this.syncDeletes()
	}
}
