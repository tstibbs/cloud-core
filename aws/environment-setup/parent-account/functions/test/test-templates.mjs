import {validate} from '@tstibbs/cloud-core-utils'

await validate('../template.yml')
await validate('../../shared/template.yml')

//just check it imports, relatively little value in testing it properly
import '../deploy/deploy-stack.mjs'
