let {handler} = await import('../src/loginChecker.js')

const {BUCKET_NAME, OBJ_KEY} = process.env

const event = {
	Records: [
		{
			s3: {
				bucket: {
					name: BUCKET_NAME
				},
				object: {
					key: OBJ_KEY
				}
			}
		}
	]
}

await handler(event, {awsRequestId: 'dummy'})
