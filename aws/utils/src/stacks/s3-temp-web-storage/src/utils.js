import dotenv from 'dotenv'
import {S3} from '@aws-sdk/client-s3'

import {defaultAwsClientConfig} from '../../../tools/aws-client-config.js'

dotenv.config()

export const s3 = new S3(defaultAwsClientConfig)

export const {BUCKET} = process.env
