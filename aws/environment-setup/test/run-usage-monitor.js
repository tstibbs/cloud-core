import {processResources} from '../src/usage-monitor.js'
import {USAGE_TYPE_LOG_GROUP} from '../src/constants.js'

const stacks = [
	{
		name: '<stack name>',
		resources: [
			{
				name: '<name of resource that the records relate to>',
				source: '<actual materialised resource name, e.g. log group name>',
				type: USAGE_TYPE_LOG_GROUP
			}
		]
	}
]
const nowDate = new Date('2022-08-25T00:00:00.000Z')
await processResources('dummy', nowDate, stacks)
