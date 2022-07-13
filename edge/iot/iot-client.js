/* Utility for connecting to IOT */

import 'dotenv/config'
import awsIotDeviceSdk from 'aws-iot-device-sdk'
const {device} = awsIotDeviceSdk

const {
	IOT_PRIVATE_KEY_PATH, //usually a path to a docker secret
	IOT_CLIENT_CERT_PATH, //usually a path to a docker secret
	IOT_CA_CERT_PATH, //usually a path to a docker secret
	IOT_CLIENT_ID, //usually passed in as an env via docker compose
	IOT_HOST //usually passed in as an env via docker compose
} = process.env

const maximumReconnectTimeMs = 30 * 60 * 1000

export function buildIotClient(topics, messageCallback) {
	const client = device({
		keyPath: IOT_PRIVATE_KEY_PATH,
		certPath: IOT_CLIENT_CERT_PATH,
		caPath: IOT_CA_CERT_PATH,
		clientId: IOT_CLIENT_ID,
		host: IOT_HOST,
		maximumReconnectTimeMs: maximumReconnectTimeMs,
		enableMetrics: false
	})

	;['connect', 'close', 'reconnect', 'offline', 'error'].forEach(event =>
		client.on(event, () => console.log(`iot:${event}`))
	)
	//client's policy must have permission to subscribe to the topic
	topics.forEach(topic => client.subscribe(topic))
	client.on('message', (topic, payload) => {
		console.log(`iot:message from ${topic}: ${payload}`)
		messageCallback(topic, payload)
	})
	return client
}

//note to recieve a message the policy must have iot:Subscribe on arn...:topicfilter/TOPIC_NAME_HERE and iot:Receive on arn...:topic/TOPIC_NAME_HERE
//topics should be in the format cmd/home-alarm-notifier/check-devices
