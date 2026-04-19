const { logInfo, logError } = require('./utils/logger')
const { validateSystem } = require('./utils/validator')

let botClient = null
let orderWatcherStarted = false

function getCreateClient() {
  const { createClient } = require('./service/wa.service')
  return createClient
}

function getHandleIncomingMessage() {
  const { handleIncomingMessage } = require('./handler/message.handler')
  return handleIncomingMessage
}

function getStartOrderWatcher() {
  const { startOrderWatcher } = require('./handler/order.handler')
  return startOrderWatcher
}

function getStartStatusScheduler() {
  const { startScheduler: startStatusScheduler, stopScheduler: stopStatusScheduler } = require('./service/status.service')
  return { startStatusScheduler, stopStatusScheduler }
}

async function initializeBot() {
  logInfo('🚀 Starting Premiumin Plus WhatsApp bot')

  if (!validateSystem()) {
    logError('System validation failed, aborting startup')
    return
  }

  const { stopStatusScheduler } = getStartStatusScheduler()
  stopStatusScheduler()
  orderWatcherStarted = false

  const createClient = getCreateClient()
  botClient = createClient()

  const handleIncomingMessage = getHandleIncomingMessage()
  botClient.on('message', async msg => {
    try {
      await handleIncomingMessage(botClient, msg)
    } catch (error) {
      logError('Message handler failed', { error: error.message, from: msg.from })
    }
  })

  botClient.on('ready', () => {
    logInfo('✅ WhatsApp client ready - initializing services')

    if (!orderWatcherStarted) {
      logInfo('Starting order watcher')
      const startOrderWatcher = getStartOrderWatcher()
      startOrderWatcher(botClient)
      orderWatcherStarted = true
    }

    logInfo('Starting status scheduler')
    const { startStatusScheduler } = getStartStatusScheduler()
    startStatusScheduler(botClient)
  })

  botClient.initialize()
}

function scheduleRestart(delay = 5000) {
  logInfo('Scheduling bot restart', { delay })
  const { stopStatusScheduler } = getStartStatusScheduler()
  stopStatusScheduler()
  orderWatcherStarted = false

  setTimeout(() => {
    try {
      initializeBot()
    } catch (error) {
      logError('Restart failed', { error: error.message })
      scheduleRestart(delay)
    }
  }, delay)
}

process.on('uncaughtException', error => {
  logError('Uncaught exception', error)
  scheduleRestart()
})

process.on('unhandledRejection', error => {
  logError('Unhandled rejection', error)
  scheduleRestart()
})

initializeBot()
