import {createInterface} from 'readline'
import {resolve} from 'path'
import {run} from './tools.js'

const CDK_OUT_DIR = resolve('cdk.out')

const askQuestion = query => {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	})

	return new Promise(resolve => {
		rl.question(query, answer => {
			rl.close()
			resolve(answer)
		})
	})
}

export async function doDiffploy(args) {
	try {
		console.log('🔎 Running CDK Diff...\n')

		await run(`cdk diff ${args}`)

		const answer = await askQuestion('\nDo you want to deploy these changes? (y/n): ')

		if (answer.toLowerCase() === 'y') {
			console.log('\n🚀 Deploying...')

			// pass '--app cdk.out' to use the assembly created by the diff step
			await run(`cdk deploy ${args} --app ${CDK_OUT_DIR} --require-approval=never`)

			console.log('\n✅ Deployment complete!')
		} else {
			console.log('\n❌ Deployment cancelled.')
			process.exit(0)
		}
	} catch (error) {
		console.error('\n🛑 An error occurred:')
		console.error(error.message)
		process.exit(1)
	}
}
