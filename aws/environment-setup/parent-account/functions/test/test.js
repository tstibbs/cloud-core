const switchRoleEvent = require('./switch-role.json')
const consoleLoginEvent = require('./console-login.json')
const {processRecords} = require('../dist/main.js')

processRecords({Records: [switchRoleEvent, consoleLoginEvent]}).then(data => console.log(data))
