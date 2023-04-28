[![License: AL2](https://img.shields.io/github/license/tstibbs/cloud-core)](LICENSE)
[![Build Status](https://github.com/tstibbs/cloud-core/workflows/CI/badge.svg)](https://github.com/tstibbs/cloud-core/actions?query=workflow%3ACI)
[![GitHub issues](https://img.shields.io/github/issues/tstibbs/cloud-core.svg)](https://github.com/tstibbs/cloud-core/issues)

## What is this?

This project is a collection of scripts and utilities for cloud stuff, either for managing my AWS organisation or utilities that are used in multiple other projects.

### AWS account set up

[Parent core stack](aws/environment-setup/lib/deploy-parent-core-stack.js) - core roles required in account that's at the root of the AWS organisation

[Parent infrastructure stack](aws/environment-setup/lib/deploy-parent-infra-stack.js) - budgets, [login monitoring](aws/environment-setup/src/loginChecker.js), [IAM checking](aws/environment-setup/src/iam-checker.js), multi-account [cloudformation drift reporter](aws/environment-setup/src/cfnStackDriftChecker.js), multi-account [web-facing API usage reporting](aws/environment-setup/src/usage-monitor.js)

[All-accounts stack](aws/environment-setup/lib/deploy-shared-stack.js) - roles required for every account in organisation, includes [function](aws/environment-setup/src/emergency-tear-down.js) to tear down stacks if costs get out of control

[IOT stack](aws/environment-setup/lib/deploy-iot.js) - setting up IOT services, includes [uptime reporter](aws/environment-setup/src/uptime-checker.js), re-usable [IOT client](edge/iot/iot-client.js), example [dockerfile](edge/iot/example-container/Dockerfile) for running an IOT client

Also includes:

- Instructions for setting up a new account added to an organisation: [aws/environment-setup/NewAccountSteps.md](aws/environment-setup/NewAccountSteps.md)
- Code shared across various projects, e.g. [aws/utils/src/stacks/cloudfront.js](aws/utils/src/stacks/cloudfront.js) and [ui/templates](ui/templates)

## Contributing

PRs are very welcome, but for any big changes or new features please open an issue to discuss first.
