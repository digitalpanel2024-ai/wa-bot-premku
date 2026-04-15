const { handleCommand } = require('./command.handler')

async function handleMessage(client, msg) {
    if (!msg.body) return
    await handleCommand(client, msg)
}

module.exports = { handleMessage }