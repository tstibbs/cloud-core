export * from '../src/runtime-envs.js'

export const DEV_MODE = process.env.DEV_MODE == 'true' //if not set, defaults to false
export const DEV_SUFFIX = DEV_MODE ? '-Dev' : '' //suffix concrete resource names in dev mode to prevent it conflicting with the actual stack

function buildAccountMappings() {
	const PREFIX = 'ACCOUNT_COLOUR_'
	const colours = Object.entries(process.env)
		.filter(([key]) => key.startsWith(PREFIX))
		.map(([key, value]) => [key.substring(PREFIX.length), {accountColour: value}])
	if (colours.length == 0) {
		throw new Error('account colours must be configured')
	}
	return Object.fromEntries(colours)
}

export const ACCOUNT_MAPPINGS = buildAccountMappings()
