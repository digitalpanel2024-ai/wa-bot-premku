const fs = require('fs')
const path = require('path')
const { MessageMedia } = require('whatsapp-web.js')
const premku = require('../service/premku/premku.service')
const payment = require('../service/payment/payment.service')

const pendingPath = path.join(__dirname, '../database/pending.json')

function readDB() {
    if (!fs.existsSync(pendingPath)) return {}
    const raw = fs.readFileSync(pendingPath, 'utf8').trim()
    return raw ? JSON.parse(raw) : {}
}

function saveDB(data) {
    fs.writeFileSync(pendingPath, JSON.stringify(data, null, 2))
}

function createQrMedia(qrImage) {
    if (!qrImage) return null

    const base64 = qrImage.includes(',') ? qrImage.split(',')[1] : qrImage
    return new MessageMedia('image/png', base64)
}

function randomCode() {
    return Math.floor(Math.random() * (292 - 30 + 1)) + 30
}

function generateUnique(total, db) {
    let final = total
    let code

    do {
        code = randomCode()
        final = total + code
    } while (Object.values(db).some(x => x.total === final && x.status === 'WAITING'))

    return { total: final, code }
}

async function handleCommand(client, msg) {
    const text = msg.body.toLowerCase().trim()

    // ================= GREETING =================
    if (['p','ping','halo','test','assalamualaikum'].includes(text)) {
        const hour = new Date().getHours()

        let greet = 'Selamat Malam 🌙'
        if (hour >= 4 && hour < 10) greet = 'Selamat Pagi 🌅'
        else if (hour < 15) greet = 'Selamat Siang ☀️'
        else if (hour < 18.5) greet = 'Selamat Sore 🌆'

        return client.sendMessage(msg.from,
`${greet}!

Selamat datang di Premiumku Store 🚀

• Ketik STOK
• Ketik MENU
• Ketik ADMIN`
        )
    }

    // ================= MENU =================
    if (text === 'menu') {
        return client.sendMessage(msg.from,
`📌 MENU

- stok
- buy
- admin
- website`
        )
    }

    if (text === 'admin') {
        return client.sendMessage(msg.from, 'WA: 083129999931')
    }

    if (text === 'website') {
        return client.sendMessage(msg.from, 'https://digitalpanelsmm.com')
    }

    // ================= STOK =================
    if (text === 'stok') {
        const res = await premku.getProducts(process.env.API_KEY)

        let msgText = '🛒 *KATALOG PREMIUMKU*\n\n'

        res.products.forEach(p => {
            if (p.stock <= 0) return

            const harga = Math.ceil(p.price * 1.8)
            const code = p.id

            msgText += `📦 ${p.name}\n`
            msgText += `📊 Stok: ${p.stock}\n`
            msgText += `💰 Rp ${harga.toLocaleString('id-ID')}\n`
            msgText += `🔑 Code: buy ${code}\n\n`
        })

        msgText += 'Ketik: buy id\nContoh: buy 1'

        return client.sendMessage(msg.from, msgText)
    }

    // ================= BUY =================
    if (text.startsWith('buy')) {
        const match = text.match(/^buy\s*(\d+)$/i)
        const id = match ? parseInt(match[1], 10) : null

        if (!id) {
            return client.sendMessage(msg.from, '❌ Format salah. Ketik: buy 1 atau buy1')
        }

        try {
            const products = await premku.getProducts(process.env.API_KEY)
            console.log('Products fetched:', products.products.length)

            const product = products.products.find(p => p.id == id)
            if (!product) {
                console.log('Product not found for ID:', id)
                return client.sendMessage(msg.from, '❌ Produk tidak ditemukan')
            }

            let db = readDB()
            const base = Math.ceil(product.price * 1.8)
            const { total } = generateUnique(base, db)

            const invoice = 'INV-' + Date.now()

            // 🔥 BUAT DEPOSIT
            const pay = await payment.createDeposit(process.env.API_KEY, total)
            console.log('Payment response:', pay)

            if (!pay.success) {
                console.log('Payment failed:', pay.message)
                return client.sendMessage(msg.from, `❌ Gagal buat pembayaran: ${pay.message || 'Unknown error'}`)
            }

            db[invoice] = {
                user: msg.from,
                product_id: id,
                total,
                invoice_pay: pay.data.invoice,
                status: 'WAITING'
            }

            saveDB(db)

            const caption =
`💳 *PEMBAYARAN PREMIUM*

📦 ${product.name}
💰 Total  : Rp ${total.toLocaleString('id-ID')}

📄 Invoice: ${pay.data.invoice}

⚠️ *WAJIB bayar sesuai nominal!*

⏳ Batas waktu: 5 menit
🔄 Otomatis diproses setelah bayar

❌ *CANCEL*: Ketik cancel ${invoice}`

            const media = createQrMedia(pay.data.qr_image)
            if (media) {
                return client.sendMessage(msg.from, media, { caption })
            }

            return client.sendMessage(msg.from,
`${caption}

💳 QRIS:
${pay.data.qr_raw}`
            )
        } catch (error) {
            console.error('Buy error:', error.message)
            return client.sendMessage(msg.from, `❌ Terjadi kesalahan: ${error.message}`)
        }
    }

    // ================= CANCEL =================
    if (text.startsWith('cancel ')) {
        const invoice = text.split(' ')[1]
        if (!invoice) {
            return client.sendMessage(msg.from, '❌ Format: cancel INV-123456789')
        }

        try {
            let db = readDB()
            if (!db[invoice] || db[invoice].user !== msg.from) {
                return client.sendMessage(msg.from, '❌ Invoice tidak ditemukan atau bukan milik Anda')
            }

            if (db[invoice].status !== 'WAITING') {
                return client.sendMessage(msg.from, '❌ Invoice sudah diproses atau expired')
            }

            // Cancel payment via API
            const cancelRes = await payment.cancelDeposit(process.env.API_KEY, db[invoice].invoice_pay)
            console.log('Cancel response:', cancelRes)

            if (cancelRes.success) {
                db[invoice].status = 'CANCELLED'
                saveDB(db)
                return client.sendMessage(msg.from, '✅ Pembayaran berhasil dibatalkan')
            } else {
                return client.sendMessage(msg.from, `❌ Gagal cancel: ${cancelRes.message || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Cancel error:', error.message)
            return client.sendMessage(msg.from, `❌ Terjadi kesalahan: ${error.message}`)
        }
    }
}
module.exports = { handleCommand }

//node index.js