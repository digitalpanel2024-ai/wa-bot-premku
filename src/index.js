const http = require('http')
const { createClient } = require('./service/wa.service')
const { cleanExpired } = require('./service/reseller.service')
const { logInfo, logError } = require('./utils/logger')
const { PORT } = require('./config')
const { validateSystem } = require('./utils/validator')
const { handleIncomingMessage } = require('./handler/message.handler')
const { checkOrders, startOrderWatcher } = require('./handler/order.handler')

let botClient = null
let orderWatcherStarted = false
let healthServer = null

function startHealthServer() {
  if (healthServer) return

  healthServer = http.createServer((req, res) => {
    if (req.url !== '/' && req.url !== '/health') {
      res.writeHead(404)
      return res.end('Not found')
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'Premiumin Plus WhatsApp Bot', uptime: process.uptime() }))
  })

  healthServer.listen(PORT, () => {
    logInfo('Health server started', { port: PORT })
  })
}

async function initializeBot() {
  logInfo('🚀 Starting Premiumin Plus WhatsApp bot')

  if (!validateSystem()) {
    logError('System validation failed, aborting startup')
    return
  }

  try {
    await cleanExpired()
  } catch (error) {
    logError('Failed to clean expired reseller data', error)
  }

  const client = createClient()
  botClient = client

  client.on('message', async msg => {
    try {
      await handleIncomingMessage(client, msg)
    } catch (error) {
      logError('Message handler failed', { error: error.message, from: msg.from })
    }
  })

  client.on('ready', () => {
    logInfo('✅ WhatsApp client ready')

    if (!orderWatcherStarted) {
      orderWatcherStarted = true
      startOrderWatcher(client)
    }
  })

  client.initialize()
  startHealthServer()
}

function scheduleRestart(delay = 5000) {
  logInfo('Scheduling bot restart', { delay })
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
  if (botClient) {
    botClient.destroy()
  }
  process.exit(1)
})

process.on('unhandledRejection', error => {
  logError('Unhandled rejection', error)
  if (botClient) {
    botClient.destroy()
  }
  process.exit(1)
})

process.on('SIGTERM', () => {
  logInfo('SIGTERM received, shutting down')
  if (botClient) {
    botClient.destroy()
  }
  if (healthServer) healthServer.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  logInfo('SIGINT received, shutting down')
  if (botClient) {
    botClient.destroy()
  }
  if (healthServer) healthServer.close()
  process.exit(0)
})

initializeBot()

