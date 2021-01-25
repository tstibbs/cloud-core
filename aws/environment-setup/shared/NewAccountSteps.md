These steps are currently impossible in cloudformation without a lot of hoop jumping.

# All accounts

1. Log in as root, set strong password and turn on MFA for the root account
1. Turn on 'block public access' in S3 at the account level (cloudformation issue: https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/168)
1. Deactivate unused STS regions in IAM / account settings
1. Create access keys for root
1. Run: `aws cloudformation create-stack --stack-name shared-account-setup --template-body file://template.yml --capabilities CAPABILITY_NAMED_IAM`
1. Verify users have been created by stack
1. Delete root account keys
1. Add account number to the list of accounts in the `ChildAccounts` parameter in the parent-account stack
1. Update password policy (due to https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/107):
   ```
   update-account-password-policy \
       --minimum-password-length 50 \
       --require-symbols \
       --require-numbers \
       --require-uppercase-characters \
       --require-lowercase-characters \
       --no-allow-users-to-change-password \
       --password-reuse-prevention 24
   ```

# Root account only

1. Turn on billing access via IAM - https://console.aws.amazon.com/billing/home?#/account / IAM User and Role Access to Billing Information / Edit / Activate IAM Access / Update
1. Activate `aws:cloudformation:stack-name` to be a cost allocation tag https://console.aws.amazon.com/billing/home#/tags
