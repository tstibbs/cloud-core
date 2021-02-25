const {NODE_ENV: mode = 'production'} = process.env

let config = {
	mode: mode,
	devtool: 'inline-source-map',
	target: 'node',
	entry: {
		loginChecker: './src/loginChecker.mjs',
		cfnStackDriftChecker: './src/cfnStackDriftChecker.mjs'
	},
	output: {
		libraryTarget: 'commonjs2'
	}
}

module.exports = config
