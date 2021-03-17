import path from 'path'
import {fileURLToPath} from 'url'
import {spawn} from 'child_process'

import watcher from 'node-watch-changes'

const watcherConfigFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'cdk.watcher-config.cjs')

export async function watchDev(additionalNpmScript) {
	if (additionalNpmScript) {
		spawn('npm', ['run', additionalNpmScript], {
			stdio: 'inherit'
		})
	}
	//sometimes the binary goes missing from path when installing from local modules, so we call directly instead
	watcher(watcherConfigFile)
}
