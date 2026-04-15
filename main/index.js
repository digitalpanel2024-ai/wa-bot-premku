require('dotenv').config()

const { startWhatsApp } = require('../service/wa/wa.service')
const { handleMessage } = require('../handler/message.handler')
const { checkOrders } = require('../handler/order.handler')

async function startBot() {
    console.log('🚀 BOT START')

    const client = startWhatsApp()

    client.on('message', async msg => {
        await handleMessage(client, msg)
    })

    client.initialize()

    // AUTO CHECK
    setInterval(() => {
        checkOrders(client)
    }, 10000)
}

startBot()

process.on('uncaughtException', err => console.log(err))
process.on('unhandledRejection', err => console.log(err))