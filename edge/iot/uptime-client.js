/* A client that connects purely for the purposes of uptime monitoring - mostly only useful for testing */

import {buildIotClient} from './iot-client.js'

const topics = []
buildIotClient(topics, (topic, payload) => {
	console.log(`iot: message unexpectedly recieved, topic=${topic}, payload=${payload}`)
})
