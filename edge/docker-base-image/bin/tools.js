import {execSync} from 'node:child_process'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {Command} from 'commander'

const PROJECT_NAME = '@tstibbs/cloud-core-base-image'

const __dirname = dirname(fileURLToPath(import.meta.url))
const libraryDir = join(__dirname, '..')

function getProjectCommitHash() {
	let commit = execSync(`git rev-parse HEAD`, {encoding: 'utf-8'}).trim()
	const changes = execSync(`git status -s`, {encoding: 'utf-8'}).trim()
	if (changes.length > 0) {
		commit += '_wip'
	}
	return commit
}

function loadProjectDetails() {
	const pnpmOut = execSync(`pnpm ls ${PROJECT_NAME} --json`, {encoding: 'utf-8'})
	return JSON.parse(pnpmOut)[0]
}

function getCloudCoreCommitHash() {
	const projectDetails = loadProjectDetails()
	const dep = projectDetails.dependencies?.[PROJECT_NAME] || projectDetails.devDependencies?.[PROJECT_NAME]
	let tag
	if (dep.version.startsWith('link:') || dep.version.startsWith('file:')) {
		tag = 'local'
	} else {
		const match = dep.resolved.match(/^http.+\/cloud-core\/tar.gz\/([A-Fa-f0-9]+)$/)
		if (match != null) {
			tag = match[1]
		} else {
			console.log(projectDetails)
			throw new Error('could not determine commit hash')
		}
	}
	if (tag == null || tag == '') {
		throw new Error(`No tag found`)
	}
	return tag
}

function getContainerName() {
	const projectName = loadProjectDetails().name
	//if @user/project-name style then drop the '@user' part
	return projectName.match(/^@[^\/]+\/(.+)$/)?.[1] || projectName
}

function run(command, workingDir) {
	const buildCmd = command
	console.log(buildCmd)
	const opts = {stdio: 'inherit'}
	if (workingDir) {
		opts.cwd = workingDir
	}
	execSync(buildCmd, opts)
}

function buildImages() {
	const cloudCoreCommitHash = getCloudCoreCommitHash()
	const thisProjectCommitHash = getProjectCommitHash()
	const containerTag = `${getContainerName()}:latest`

	console.log(`📦 Building base image...`)
	const buildCmd = `docker build -t cloud-core-base-image:build .`
	run(buildCmd, `${libraryDir}/src`)

	console.log(`🏗️  Building application image...`)
	const buildAppCmd = [
		`docker build`,
		`--label org.opencontainers.image.base.revision=${cloudCoreCommitHash}`,
		`--label org.opencontainers.image.revision=${thisProjectCommitHash}`,
		`-t ${containerTag}`,
		`.`
	].join(' ')
	run(buildAppCmd)
	return containerTag
}

function deployImage(tag, server) {
	console.log(`🚚 Streaming ${tag} to ${server}...`)
	const streamCmd = `docker save ${tag} | gzip | ssh ${server} "gunzip | docker load"`
	run(streamCmd)
	console.log('✅ App image loaded on target host.')
}

const program = new Command()

program.name('cloud-core-base-image-cli').description('Helper CLI to manage pnpm-versioned base Docker images')

program.command('build').description('Build the docker image, and if the base image if necessary').action(buildImages)

program
	.command('deploy')
	.description('Build the image and stream it to a remote server over SSH')
	.requiredOption('-s, --server <ssh-target>', 'Target server string (e.g., user@homeserver)')
	.action(options => {
		const containerTag = buildImages()
		deployImage(containerTag, options.server)
	})

export function cli() {
	program.parse(process.argv)
}
