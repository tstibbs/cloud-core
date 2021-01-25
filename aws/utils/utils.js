import util from 'util'
import fs from 'fs'
import {exec as nodeExec} from 'child_process'
import dotenv from 'dotenv'
import esMain from 'es-main'

dotenv.config() //make sure we've read region config etc

export function exec(command) {
	return new Promise((resolve, reject) => {
		nodeExec(command, (error, stdout, stderr) => {
			if (error) {
				reject({
					error,
					stdout,
					stderr
				})
			} else {
				resolve({
					stdout,
					stderr
				})
			}
		})
	})
}

export function loadEnvs(envs) {
	let missing = Object.keys(envs).filter(env => !(env in process.env))
	if (missing.length > 0) {
		console.log(process.cwd())
		throw new Error(`${missing.join(', ')} not found in environment:\n${JSON.stringify(process.env, null, 2)}`)
	}
	return Object.fromEntries(Object.entries(envs).map(([env, varName]) => [varName, process.env[env]]))
}

export async function ifCmd(importMeta, doit) {
	//execute only if run from command line
	if (esMain(importMeta)) {
		try {
			await doit()
		} catch (err) {
			console.log(err)
			process.exit(1)
		}
	}
}

export const readFile = util.promisify(fs.readFile)
