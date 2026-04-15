const fs = require('fs')
const path = require('path')
const payment = require('../service/payment/payment.service')
const premku = require('../service/premku/premku.service')

const pendingPath = path.join(__dirname, '../database/pending.json')

function readDB() {
    if (!fs.existsSync(pendingPath)) return {}
    const raw = fs.readFileSync(pendingPath, 'utf8').trim()
    return raw ? JSON.parse(raw) : {}
}

function saveDB(data) {
    fs.writeFileSync(pendingPath, JSON.stringify(data, null, 2))
}

async function checkOrders(client) {
    let db = readDB()

    for (const key in db) {
        const trx = db[key]

        if (trx.status !== 'WAITING') continue

        try {
            const pay = await payment.checkDeposit(
                process.env.API_KEY,
                trx.invoice_pay
            )
            console.log('Check payment for', key, ':', pay)

            if (pay.data?.status === 'success') {
                console.log('Payment success for', key, '- creating order')

                // 🔥 ORDER KE PREMKU
                const order = await premku.createOrder(
                    process.env.API_KEY,
                    trx.product_id,
                    1,
                    key
                )
                console.log('Order response:', order)

                if (!order.success) {
                    console.log('Order failed:', order.message)
                    continue
                }

                const status = await premku.checkOrder(
                    process.env.API_KEY,
                    order.invoice
                )
                console.log('Check order status:', status)

                if (status.status === 'success' && status.accounts && status.accounts.length > 0) {
                    const acc = status.accounts[0]

                    // Parse password and note from API response
                    const passwordParts = acc.password.split(' - ')
                    const password = passwordParts[0]
                    const note = passwordParts.slice(1).join(' - ')

                    if (trx.qr_message_id) {
                        try {
                            await client.deleteMessage(trx.user, trx.qr_message_id)
                            console.log('Deleted QR message for', key)
                        } catch (err) {
                            console.log('Unable to delete QR message:', err.message)
                        }
                    }

                    await client.sendMessage(trx.user,
`✅ *PEMBAYARAN BERHASIL*

📧 Email: ${acc.username}
🔑 Password: ${password}

📦 Produk: ${status.product}
📄 Invoice: ${key}

${note ? `📝 *Catatan:* ${note}` : ''}

Terima kasih telah berbelanja! 🚀`
                    )

                    db[key].status = 'SUCCESS'
                    console.log('Order completed for', key)
                } else {
                    console.log('Order not ready yet for', key)
                }
            } else if (pay.data?.status === 'expired' || pay.data?.status === 'failed') {
                db[key].status = 'EXPIRED'
                console.log('Payment expired for', key)
            }
        } catch (error) {
            console.error('Error checking order', key, ':', error.message)
        }
    }

    saveDB(db)
}

module.exports = { checkOrders }