let toolsPromise = import('./tools.js')

const exec = async (spawn, command) => {
	await spawn('bash', ['-c', command])
}

const rebuild = async spawn => {
	let tools = await toolsPromise
	await tools.testsynth()
	await exec(spawn, 'echo "Stack synthesised to: cdk.tmp/template.yml"')
	await exec(spawn, 'npm run test')
}

const onChange = async (events, spawn) => {
	if (events.change) {
		await exec(spawn, 'echo "\n\nChange detected..."')
		await rebuild(spawn)
	}
}

const onStart = async spawn => {
	try {
		await rebuild(spawn)
	} catch (e) {
		//ignore, a compilation failure here shouldn't affect the echo below
	}
	await exec(spawn, 'echo "\nWatching for changes..."')
}

const config = {
	directory: '.',
	ignore: [/node_modules/, /\.git/, /cdk\.out/, /cdk\.tmp/],
	onStart: onStart,
	onChange: onChange,
	verbosity: 'minimal'
}

module.exports = config
