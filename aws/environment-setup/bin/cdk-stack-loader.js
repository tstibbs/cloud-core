#!/usr/bin/env node

import {buildParentStack, buildSharedStack} from '../lib/deploy-utils.js'

buildSharedStack()
buildParentStack()
