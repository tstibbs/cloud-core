# CodeBuild failure notifications

This stack creates a reusable Lambda + EventBridge rule that forwards CodeBuild failures to a build notifications SNS topic.

Use it like this:

```js
import {CodeBuildFailureNotifications} from '@tstibbs/cloud-core-utils/src/stacks/codebuild-failure-notification/lib/stack.js'

const notificationTopic = new Topic(stack, 'BuildNotificationsTopic')
const notifier = new CodeBuildFailureNotifications(stack, notificationTopic)
notifier.addProject(someCodeBuildProject)
```
