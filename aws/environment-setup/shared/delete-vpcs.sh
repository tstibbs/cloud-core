#!/bin/bash

set -euo pipefail

# list regions
regions=$(aws ec2 describe-regions --filters "Name=opt-in-status,Values=opt-in-not-required,opted-in" --query "Regions[*].RegionName" --output text)

for region in $regions
do
	echo "=============================="
	echo "Cleaning out $region"
	# get default vpc id
	vpc=$(aws --region $region ec2 describe-vpcs --filters "Name=isDefault,Values=true" --output text --query 'Vpcs[*].VpcId')

	if [ -z "$vpc" ]
	then
		echo "No default VPC found for $region"
	else
		# get attached internet-gateways
		igws=$(aws --region $region ec2 describe-internet-gateways --output text --filters "Name=attachment.vpc-id,Values=$vpc" --query 'InternetGateways[*].InternetGatewayId')

		# get subnets
		subnets=$(aws --region $region ec2 describe-subnets --output text --filters "Name=vpc-id,Values=$vpc" --query 'Subnets[*].SubnetId')

		# note other things (e.g. default security groups) are deleted automatically when the VPC is deleted, so we don't need to delete them explicitly

		# delete them all
		for subnet in $subnets
		do
			aws --region $region ec2 delete-subnet --subnet-id $subnet
		done

		for igw in $igws
		do
			aws --region $region ec2 detach-internet-gateway --internet-gateway-id $igw --vpc-id $vpc
			aws --region $region ec2 delete-internet-gateway --internet-gateway-id $igw
		done

		aws --region $region ec2 delete-vpc --vpc-id $vpc
	fi
done
