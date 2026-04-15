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

function calculatePrice(price) {
    let marginPercent = 0.11

    if (price <= 4999) marginPercent = 0.79
    else if (price <= 8999) marginPercent = 0.56
    else if (price <= 19999) marginPercent = 0.19
    else if (price <= 100000) marginPercent = 0.11

    return Math.ceil(price + price * marginPercent)
}

function randomCode() {
    return Math.floor(Math.random() * (399 - 100 + 1)) + 100
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

Selamat datang di *Premiumin Plus* 🚀  
Pusat akun premium legal, murah, dan full otomatis ⚡

Mau cari akun apa hari ini?

📌 *Menu Utama:*
• Ketik *STOK* → lihat katalog produk
• Ketik *MENU* → menu lengkap
• Ketik *ADMIN* → bantuan langsung

💸 *Mau untung lebih?*
Gabung jadi *RESELLER* dan dapat harga lebih murah!  
Bisa jual ulang dengan profit bebas 🔥

Ketik *RESELLER* untuk info lengkap.`
        )
    }

    // ================= MENU =================
    if (text === 'menu') {
        return client.sendMessage(msg.from,
`😎 *MENU PREMIUMIN PLUS*

📌 *Menu Utama:*
• ketik *stok* → cek produk tersedia
• ketik *buy* → beli akun premium
• ketik *admin* → hubungi admin (no toxic / no rasis)
• ketik *website* → SSM Panel (Beta)`
        )
    }

    if (text === 'admin') {
        return client.sendMessage(msg.from, 'WA: 083129999931')
    }

    if (text === 'website') {
        return client.sendMessage(msg.from, 'https://digitalpanelsmm.com')
    }

    if (text === 'reseller') {
        return client.sendMessage(msg.from,
`💰 *PROGRAM RESELLER PREMIUMIN PLUS*

Keuntungan jadi Reseller:
✅ Harga lebih murah 10-20%
✅ Komisi otomatis
✅ Support 24/7
✅ Produk lengkap

📊 *Tier Reseller:*
🥉 Bronze: 5 transaksi/bulan → Diskon 10%
🥈 Silver: 15 transaksi/bulan → Diskon 15%
🥇 Gold: 30 transaksi/bulan → Diskon 20%

📞 *Cara Daftar:*
1. Minimal deposit Rp 50.000
2. Chat admin untuk aktivasi
3. Dapat panel reseller pribadi

💬 Hubungi: 083129999931`
        )
    }

    // ================= STOK =================
    if (text === 'stok') {
        const res = await premku.getProducts(process.env.API_KEY)

        let msgText = '🛒 *KATALOG PREMIUMIN PLUS*\n\n'

        res.products.forEach(p => {
            if (p.stock <= 0) return

            const harga = calculatePrice(p.price)
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
            const base = calculatePrice(product.price)
            const { total, code } = generateUnique(base, db)

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
                unique_code: code,
                invoice_pay: pay.data.invoice,
                status: 'WAITING'
            }

            saveDB(db)

            const caption =
`💳 *PEMBAYARAN PREMIUMIN PLUS*

📦 ${product.name}
💰 Total  : Rp ${total.toLocaleString('id-ID')}

📄 Invoice: ${pay.data.invoice}

⚠️ *WAJIB bayar sesuai nominal!*

⏳ Batas waktu: 5 menit
🔄 Otomatis diproses setelah bayar

❌ *CANCEL*: Ketik cancel ${invoice}`

            const media = createQrMedia(pay.data.qr_image)
            if (media) {
                const sent = await client.sendMessage(msg.from, media, { caption })
                const qrMessageId = sent.id?._serialized || sent.id
                db[invoice].qr_message_id = qrMessageId
                saveDB(db)
                return sent
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