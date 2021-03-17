import {spawn} from 'child_process'
import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'

import {watchDev} from './watchDev.js'

function run(command) {
	return new Promise((resolve, reject) => {
		let childProcess = spawn('bash', ['-c', command], {
			stdio: 'inherit'
		})
		childProcess.on('close', code => {
			if (code === 0) {
				resolve(code)
			} else {
				reject(code)
			}
		})
	})
}

function parseAdditionalArgs(argv) {
	if (argv && argv._ && argv._.length > 1) {
		let args = argv._.slice(1)
			.map(arg => arg.replace(/"/g, '\\"'))
			.join('" "')
		args = `"${args}"`
		return args
	} else {
		return ''
	}
}

async function watch(argv) {
	await watchDev(argv.additionalNpmScript)
}

export async function testsynth(argv) {
	let otherArgs = parseAdditionalArgs(argv)
	let stack = process.env.STACK || ''
	await run(`cdk synth --version-reporting false --asset-metadata false ${otherArgs} ${stack} > cdk.tmp/template.yml`)
}

async function testcdk(argv) {
	let otherArgs = parseAdditionalArgs(argv)
	await run(`NODE_OPTIONS=--experimental-vm-modules jest ${otherArgs}`)
}

async function dryrun(argv) {
	let otherArgs = parseAdditionalArgs(argv)
	await run(`cdk diff ${otherArgs}`)
}

async function deploy(argv) {
	let otherArgs = parseAdditionalArgs(argv)
	await run(`cdk deploy ${otherArgs}`)
}

export function cli() {
	yargs(hideBin(process.argv))
		.command(
			'watch [additionalNpmScript]',
			'Watches for stack and code changes and reruns stack synthesis and tests.',
			{},
			watch
		)
		.command('testsynth', 'Just synthesises the stack to an output file for manual inspection.', {}, testsynth)
		.command('testcdk', 'Runs jest tests which can be used to test the actual cdk stack.', {}, testcdk)
		.command('dryrun', 'Shows the diff (i.e. what would happen if a deployment was run).', {}, dryrun)
		.command('deploy', '', {}, deploy)
		.demandCommand(1, 'Please choose a command.')
		.version(false)
		.wrap(null)
		.strictCommands()
		.fail((msg, err, yargs) => {
			if (err === undefined) {
				console.error(yargs.help())
				process.exit(1)
			} else {
				if (typeof err === 'number') {
					process.exit(err)
				} else {
					if (msg != null) {
						console.error(msg)
					}
					if (err != null) {
						console.error(err)
					}
					process.exit(1)
				}
			}
		}).argv
}
