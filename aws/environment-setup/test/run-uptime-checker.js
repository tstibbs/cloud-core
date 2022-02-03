let {handler} = await import('../src/uptime-checker.js')
await handler({}, {awsRequestId: 'dummy'})
