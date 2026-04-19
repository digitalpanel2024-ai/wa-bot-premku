const { enqueue } = require('../utils/queue')
const { parseCommand } = require('../utils/router')
const { handleCommand } = require('./command.handler')
const { logInfo } = require('../utils/logger')

async function handleIncomingMessage(client, msg) {
  const userId = msg.from
  const body = msg.body ? String(msg.body).trim().toLowerCase() : ''

  logInfo('[COMMAND]', { userId, body: body.substring(0, 50) })

  if (!body || msg.type !== 'chat') return
  if (userId.includes('broadcast') || userId.includes('status')) return

  try {
    const { enqueue } = require('../utils/queue')
    const { parseCommand } = require('../utils/router')
    const { handleCommand } = require('./command.handler')
    const { logError } = require('../utils/logger')

    const commandData = parseCommand(body)
    if (!commandData) return

    enqueue(client, msg, handleCommand)
  } catch (error) {
    const { logError } = require('../utils/logger')
    logError('Message processing error', { userId, error: error.message })
    client.sendMessage(userId, '⚠️ Terjadi error, coba lagi').catch(() => {})
  }
}

module.exports = {
  handleIncomingMessage
}
