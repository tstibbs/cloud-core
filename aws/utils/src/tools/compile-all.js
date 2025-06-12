//just import everything and check there are no errors - no value in testing beyond this

import {strict as assert} from 'node:assert'
import {readdir} from 'node:fs/promises'
import {join, extname, resolve} from 'node:path'

export async function importAll(meta, dirPath) {
	dirPath = join(meta.dirname, dirPath)
	console.log(`Checking ${dirPath}`)
	const oldExitCode = process.exitCode //cache exit code in case one of the files we load sets an exit code
	const files = (await readdir(dirPath, {recursive: true})).filter(file => extname(file) === '.js')
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
