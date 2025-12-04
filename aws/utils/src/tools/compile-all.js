//just import everything and check there are no errors - no value in testing beyond this

import {strict as assert} from 'node:assert'
import {join, resolve} from 'node:path'

import {simpleGit} from 'simple-git'

export async function importAll(meta, dirPath) {
	dirPath = join(meta.dirname, dirPath)
	console.log(`Checking ${dirPath}`)
	const oldExitCode = process.exitCode //cache exit code in case one of the files we load sets an exit code
	const files = await listFiles(dirPath)
	const failures = []
	for (let file of files) {
		console.log(file)
		const filePath = resolve(join(dirPath, file))
		try {
			await import(filePath)
		} catch (e) {
			failures.push(file)
			console.error(e)
		}
	}
	process.exitCode = oldExitCode
	console.log(`\nFinished checking ${files.length} files.\n`)
	assert.equal(failures.length, 0, `import failures happened: ${failures.join(', ')}`)
}

async function listFiles(dirPath) {
	//ask git to list the files, so we can take advantage of its handling of .gitignore files
	const git = simpleGit(dirPath)
	const commandArgs = [
		'ls-files',
		'--exclude-standard', // ignore everything ignored by '.gitignore'
		'--cached', // include tracked files
		'--others', // include untracked files
		'*.js',
		':!:*.test.js', // exclude tests, as things like jest describe won't be available
		'*.mjs'
	]
	const fileList = await git.raw(commandArgs)
	return fileList.trim().split('\n')
}
