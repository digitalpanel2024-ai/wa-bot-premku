const fs = require('fs')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const path = require('path')
const { logInfo, logError } = require('../utils/logger')

const sessionDir = path.join(process.cwd(), 'sessions')
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true })
}

function createClient() {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionDir,
      clientId: "premiumin-bot"
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    },
    takeScreenshots: false
  })

  client.on('qr', (qr) => {
    logInfo('🔳 QR code generated - scan with WhatsApp')
    qrcode.generate(qr, { small: true })
  })

  client.on('authenticated', () => {
    logInfo('✅ WhatsApp authenticated')
  })

  client.on('ready', () => {
    logInfo('🚀 WhatsApp client ready & connected')
  })

  client.on('auth_failure', (msg) => {
    logError('❌ Auth failure', msg)
    setTimeout(() => client.initialize(), 5000)
  })

  client.on('disconnected', (reason) => {
    logError('🔌 Disconnected', reason)
    setTimeout(() => client.initialize(), 5000)
  })

  client.on('message_create', (msg) => {
    if (msg.fromMe) return // ignore self
  })

  return client
}

module.exports = { createClient }
