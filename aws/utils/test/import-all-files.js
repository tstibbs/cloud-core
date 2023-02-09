import {join, dirname} from 'path'
import {fileURLToPath} from 'url'
import {list} from 'recursive-readdir-async'
import {strict as assert} from 'assert'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src')
let files = await list(dir)
assert.equal(files.error, undefined)
files = files
	.filter(file => file.name.endsWith('.js') || file.name.endsWith('.mjs') || file.name.endsWith('.cjs'))
	.map(file => file.fullname)
console.log(files)
assert.equal(files.length, 12) //sanity check in case a change happens which breaks this test; update this if the number of files changes
for (let file of files) {
	console.log(file)
	await import(file)
}
process.exitCode = 0 //because cli sets the exit code
