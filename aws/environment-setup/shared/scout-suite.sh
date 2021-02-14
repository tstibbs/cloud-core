#!/bin/bash

set -euo pipefail

[ $# -eq 0 ] && { echo "Usage: $0 <space separated list of aws profiles>"; exit 1; }
# Note the profiles referred to here are by default set in ~/.aws/credentials

trap 'cleanup $?' EXIT

cleanup() {
	if [ -n "${containerId:-}" ]
	then
		docker stop $containerId
		docker rm $containerId
	fi
}

docker pull rossja/ncc-scoutsuite
mkdir -p ../../../reports/aws

for awsProfile in "$@"
do
	containerId=$(docker create \
		-it \
		-v ~/.aws/config:/root/.aws/config \
		-v ~/.aws/credentials:/root/.aws/credentials \
		rossja/ncc-scoutsuite \
		bash -c 'source /root/scoutsuite/bin/activate && scout aws --profile '"$awsProfile"' --no-browser --report-dir /root/scout-report')
	docker start --attach $containerId
	docker cp $containerId:/root/scout-report/. ../../../reports/aws/
	docker rm $containerId
	unset containerId
done
