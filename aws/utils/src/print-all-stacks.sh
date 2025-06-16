#!/bin/bash

# Get a list of available AWS profiles
profiles=$(aws configure list-profiles | grep '\-developer$')

# Iterate over each profile
for profile in $profiles; do
  # Set the current profile

  # Get a list of all stacks
  stacks=$(AWS_PROFILE=$profile aws cloudformation describe-stacks --query 'Stacks[].StackName' --output text)

  # Filter out deleted and failed stacks
  successful_stacks=()
  for stack in $stacks; do
    if [[ "$stack" != "CDKToolkit" ]];
    then
      status=$(AWS_PROFILE=$profile aws cloudformation describe-stacks --stack-name $stack --query 'Stacks[0].StackStatus' --output text)
      if [[ $status == "CREATE_COMPLETE" || $status == "UPDATE_COMPLETE" ]]; then
        successful_stacks+=("$stack")
      fi
    fi
  done

  # Print the profile and its stacks
  if [ ${#successful_stacks[@]} -gt 0 ]; then
    printf "AWS_PROFILE=$profile npx cdk diff --strict --fail %s\n" "${successful_stacks[@]}"
    echo ''
  fi
done
