#!/bin/bash

# set -eux -o pipefail

cd ~/workspace/Code/GitHub/cloud-core/aws/environment-setup
AWS_PROFILE=parent-developer npx cdk diff --strict --fail AllAccountsStack
AWS_PROFILE=dev-developer npx cdk diff --strict --fail AllAccountsStack
AWS_PROFILE=prod-personal-developer npx cdk diff --strict --fail AllAccountsStack
AWS_PROFILE=prod-public-developer npx cdk diff --strict --fail AllAccountsStack
AWS_PROFILE=parent-developer npx cdk diff --strict --fail ParentAccountInfraStack
AWS_PROFILE=parent-developer npx cdk diff --strict --fail ParentAccountCoreStack
AWS_PROFILE=prod-personal-developer npx cdk diff --strict --fail IotStack

# cd ~/workspace/Code/GitHub/dahua-app/aws
# AWS_PROFILE=dev-developer npx cdk diff --strict #--fail dahua-app
# # npm uninstall @tstibbs/cloud-core-utils && npm install --save-dev file:../../cloud-core/aws/utils

# cd ~/workspace/Code/GitHub/smart-home-integration
# # AWS_PROFILE=prod-personal-developer npx cdk diff --strict #--fail smart-home-integration
# # npm uninstall @tstibbs/cloud-core-utils && npm install --save-dev file:../cloud-core/aws/utils
# cd ~/workspace/Code/GitHub/tim-personal-private/aws-data-storage
# # AWS_PROFILE=prod-personal-developer npx cdk diff --strict #--fail PersonalWebsiteStack
# # npm uninstall @tstibbs/cloud-core-utils && npm install --save-dev file:../../cloud-core/aws/utils
# cd ~/workspace/Code/GitHub/home-alarm-notifier/aws/functions
# # AWS_PROFILE=prod-personal-developer npx cdk diff --strict #--fail home-alarm-notifier
# # npm uninstall @tstibbs/cloud-core-utils && npm install --save-dev file:../../../cloud-core/aws/utils

# cd ~/workspace/Code/GitHub/geo-bagging/backend
# # AWS_PROFILE=prod-public-developer npx cdk diff --strict #--fail GeoBaggingBackend
# # npm uninstall @tstibbs/cloud-core-utils && npm install --save-dev file:../../cloud-core/aws/utils
# cd ~/workspace/Code/GitHub/pdf-viewer-sync/backend
# AWS_PROFILE=prod-public-developer npx cdk diff --strict #--fail pdf-viewer-sync
# # npm uninstall @tstibbs/cloud-core-utils && npm install --save-dev file:../../cloud-core/aws/utils
