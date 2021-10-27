These steps are currently impossible in cloudformation without a lot of hoop jumping.

# All accounts

1. Log in as root, set strong password and turn on MFA for the root account
1. Turn on 'block public access' in S3 at the account level (cloudformation issue: https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/168)
1. Deactivate unused STS regions in IAM / account settings
1. Create access keys for root
1. Bootstrap account for CDK (ensuring to use a cdk.json that specifies new-style synthesis) `npx cdk bootstrap --bootstrap-kms-key-id AWS_MANAGED_KEY --profile [aws profile name] aws://[account id]/eu-west-2`
1. Run: `npx cdk deploy AllAccountsStack --profile [aws profile name]`
1. Verify users have been created by stack
1. Update bootstap: `npx cdk bootstrap --cloudformation-execution-policies "arn:aws:iam::[account id]:policy/developerPolicy" --bootstrap-kms-key-id AWS_MANAGED_KEY --profile [aws profile name] aws://[account id]/eu-west-2`
1. Update password policy (due to https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/107):
   ```
   aws iam update-account-password-policy \
       --minimum-password-length 50 \
       --require-symbols \
       --require-numbers \
       --require-uppercase-characters \
       --require-lowercase-characters \
       --no-allow-users-to-change-password \
       --password-reuse-prevention 24
   ```
1. Delete root account keys
1. Run tools/delete-vpcs.sh
1. Add account number to the list of accounts in the `ChildAccounts` parameter in the parent-account stack

# Root account only

1. Turn on billing access via IAM - https://console.aws.amazon.com/billing/home?#/account / IAM User and Role Access to Billing Information / Edit / Activate IAM Access / Update
1. Activate `aws:cloudformation:stack-name` to be a cost allocation tag https://console.aws.amazon.com/billing/home#/tags
1. Run: `aws organizations enable-aws-service-access --service-principal cloudtrail.amazonaws.com`
1. Run: `aws cloudtrail create-trail --name all-accounts-management-events --s3-bucket-name ${CloudTrailLogsBucket} --is-organization-trail --is-multi-region-trail` ( IsOrganizationTrail not supported by cloudformation yet so have to use cli, see https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/45)
1. Run: `aws cloudtrail start-logging --name all-accounts-management-events`
