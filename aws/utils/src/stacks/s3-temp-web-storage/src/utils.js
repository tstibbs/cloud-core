import dotenv from 'dotenv'
import aws from 'aws-sdk'

dotenv.config()

aws.config.apiVersions = {
	s3: '2006-03-01'
}

export {aws}

export const {BUCKET} = process.env
