import {join, dirname} from 'path'
import {fileURLToPath} from 'url'
import {list} from 'recursive-readdir-async'
import {strict as assert} from 'assert'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src')
let files = await list(dir)
assert.equal(files.error, undefined)
files = files.map(file => file.fullname)
console.log(files)
for (let file of files) {
	console.log(file)
	await import(file)
}
process.exitCode = 0 //because cli sets the exit code
assert.equal(files.length, 10) //sanity check, update if the number of files changes
