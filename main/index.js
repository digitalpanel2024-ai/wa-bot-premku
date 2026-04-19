require('dotenv').config()

const { startWhatsApp } = require('../service/wa/wa.service')
const { handleMessage } = require('../handler/message.handler')
const { checkOrders } = require('../handler/order.handler')
const { logInfo, logError } = require('../utils/logger')

let client = null
let orderInterval = null

function startOrderCheck(clientInstance) {
    if (orderInterval) clearInterval(orderInterval)
    orderInterval = setInterval(() => {
        checkOrders(clientInstance).catch(err => logError('Order check failed', err))
    }, 10000)
}

async function startBot() {
    logInfo('🚀 BOT START')

    client = startWhatsApp()
    client.initialize()
    startOrderCheck(client)
}

process.on('uncaughtException', async (err) => {
    logError('Uncaught exception', err)
    try {
        await client?.destroy()
    } catch (destroyErr) {
        logError('Failed to destroy client', destroyErr)
    }
    process.exit(1)
})

process.on('unhandledRejection', async (err) => {
    logError('Unhandled rejection', err)
    try {
        await client?.destroy()
    } catch (destroyErr) {
        logError('Failed to destroy client', destroyErr)
    }
    process.exit(1)
})

process.on('SIGINT', async () => {
    logInfo('SIGINT received, shutting down gracefully...')
    try {
        await client?.destroy()
    } catch (destroyErr) {
        logError('Failed to destroy client on SIGINT', destroyErr)
    }
    process.exit(0)
})

process.on('SIGTERM', async () => {
    logInfo('SIGTERM received, shutting down gracefully...')
    try {
        await client?.destroy()
    } catch (destroyErr) {
        logError('Failed to destroy client on SIGTERM', destroyErr)
    }
    process.exit(0)
})

startBot()