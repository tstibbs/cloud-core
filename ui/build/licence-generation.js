export const defaultLicenseWebpackPluginConfig = {
	perChunkOutput: false,
	handleMissingLicenseType: packageName => {
		throw new Error(`Cannot find license for ${packageName}`)
	},
	handleMissingLicenseText: (packageName, licenseType) => {
		throw new Error(`Cannot find license text for ${packageName} (${licenseType})`)
	},
	handleLicenseAmbiguity: (packageName, licenses) => {
		throw new Error(`Ambiguous licence detected: ${packageName}, ${licenses}`)
	}
}
