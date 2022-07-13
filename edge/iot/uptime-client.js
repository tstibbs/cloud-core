/* A client that connects purely for the purposes of uptime monitoring - mostly only useful for testing */

import {buildIotClient} from './iot-client.js'

const topics = []
buildIotClient(topics, (topic, payload) => {
	console.log(`iot: message unexpectedly recieved, topic=${topic}, payload=${payload}`)
})

//just to keep it running and listening:
setInterval(() => {}, 15.5 * 24 * 60 * 60 * 1000) //can't be over max int, and using a number of days that doesn't divide by 7 means that it will be at a different time/day
