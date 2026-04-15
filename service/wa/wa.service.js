const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const path = require('path')

function startWhatsApp() {
    const sessionId = Date.now().toString()
    const sessionPath = path.join('./sessions', sessionId)

    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: sessionPath
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
                '--single-process', // Added for stability
                '--disable-gpu'
            ]
        }
    })

    client.on('qr', qr => {
        console.log('📱 Scan QR Code:')
        qrcode.generate(qr, { small: true })
    })

    client.on('ready', () => {
        console.log('✅ WhatsApp Connected')
    })

    client.on('auth_failure', msg => {
        console.error('❌ Authentication failed:', msg)
    })

    client.on('disconnected', reason => {
        console.log('🔌 WhatsApp disconnected:', reason)
    })

    return client
}

module.exports = { startWhatsApp }