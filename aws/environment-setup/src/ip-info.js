import assert from 'assert'
import {IPinfoWrapper} from 'node-ipinfo'

import {IP_INFO_TOKEN, USAGE_HIGH_RISK_COUNTRIES, USAGE_MY_COUNTRY_CODES} from './runtime-envs.js'
const inBothCountryLists = USAGE_HIGH_RISK_COUNTRIES.filter(code => USAGE_MY_COUNTRY_CODES.includes(code))
assert.strictEqual(
	inBothCountryLists.length,
	0,
	'Nothing in USAGE_MY_COUNTRY_CODES can appear in USAGE_HIGH_RISK_COUNTRIES.'
)
assert.ok(IP_INFO_TOKEN.length > 0, 'IP_INFO_TOKEN not set.')

const ipinfo = new IPinfoWrapper(IP_INFO_TOKEN)

export async function getIpInfo(ips) {
	if (ips.length == 0) {
		//if we've ended up requesting nothing, return early. This makes it easier to pass straight to this method with the output of a .filter or similar
		return {}
	} else {
		ips = [...new Set(ips)] //only pass a unique set of IPs
		let response = await ipinfo.getBatch(ips)
		if (Object.values(response).some(entry => entry.readme == 'https://ipinfo.io/missingauth')) {
			throw new Error(
				"IP_INFO_TOKEN not set or invalid (API call returned entry.readme == 'https://ipinfo.io/missingauth'."
			)
		}
		let results = Object.fromEntries(
			Object.values(response).map(entry => {
				let {ip, countryCode} = entry
				let risk = null
				if (USAGE_HIGH_RISK_COUNTRIES.includes(countryCode)) {
					risk = 'high'
				} else if (USAGE_MY_COUNTRY_CODES.includes(countryCode)) {
					risk = 'low'
				} else {
					// is somewhere in the world, but not my countries or high risk countries
					risk = 'medium'
				}
				let description = `${entry.country} > ${entry.region} > ${entry.city} (${entry.org})`
				let shortDescription = `${entry.country} (${entry.org})`
				return [
					ip,
					{
						risk,
						description,
						shortDescription
					}
				]
			})
		)
		return results
	}
}
