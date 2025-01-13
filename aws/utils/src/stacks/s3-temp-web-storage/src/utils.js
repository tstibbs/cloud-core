import dotenv from 'dotenv'
import {S3} from '@aws-sdk/client-s3'

dotenv.config()

export const s3 = new S3({
	region: 'eu-west-2',
	apiVersion: '2006-03-01'
})

export const {BUCKET} = process.env
