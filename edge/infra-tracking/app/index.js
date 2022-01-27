import {run, checkIn} from './app.js'

console.log(`Running... ${new Date()}`)

var args = process.argv.slice(2)
if (args.length == 0) {
	run().catch(err => {
		console.log('Caught')
		console.log(err)
		throw err //want to ensure the app terminates so that docker will start the container back up, otherwise the running app could just be dead
	})
} else if (args.length == 1 && args[0] == 'test') {
	checkIn()
} else {
	throw new Error(`Unsupported args (did you mean 'test'?): ${JSON.stringify(args)}`)
}
