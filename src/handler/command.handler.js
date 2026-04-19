const premku = require('../service/premku.service')
const payment = require('../service/payment.service')
const resellerService = require('../service/reseller.service')
const db = require('../database/db')
const { parseCommand } = require('../utils/router')
const {
  sanitizeText,
  formatCurrency,
  buildHeader,
  buildQrMedia,
  calculateSalePrice,
  buildInvoiceId
} = require('../utils/formatter')
const { logInfo, logError } = require('../utils/logger')
const { API_KEY } = require('../config')

const RESELLER_PLANS = {
  '1': { label: '1 Bulan', type: 'monthly', price: 10000 },
  '2': { label: '12 Bulan', type: 'yearly', price: 50000 },
  '3': { label: 'Unlimited', type: 'unlimited', price: 100000 }
}

function formatExpiry(timestamp) {
  if (!timestamp) return 'Tidak ditentukan'
  return new Date(timestamp).toLocaleString('id-ID')
}

async function greetingHandler({ client, msg }) {
  const text = sanitizeText(msg.body).toLowerCase()
  if (['p', 'ping', 'halo', 'test', 'assalamualaikum'].includes(text)) {
    const hour = new Date().getHours()
    let greeting = 'Selamat Malam 🌙'
    if (hour >= 4 && hour < 10) greeting = 'Selamat Pagi 🌅'
    else if (hour < 15) greeting = 'Selamat Siang ☀️'
    else if (hour < 18.5) greeting = 'Selamat Sore 🌆'

    return client.sendMessage(msg.from,
`${buildHeader('Sapa Pengguna')}
${greeting}!

Selamat datang di *Premiumin Plus* 🚀
Pusat akun premium legal, murah, dan otomatis.

*Menu Cepat:*
• ketik *STOK* untuk lihat produk
• ketik *MENU* untuk menu lengkap
• ketik *ADMIN* untuk kontak admin
`)
  }
}

async function menuHandler({ client, msg }) {
  return client.sendMessage(msg.from,
`${buildHeader('Menu Premiumin Plus')}
📌 _Panduan singkat penggunaan bot_

• *STOK* → daftar produk ready
• *BUY <id>* atau *BUY<id>* → mulai transaksi
• *CANCEL INV-...* → batalkan pembayaran
• *GABUNG* → daftar reseller
• *ADMIN* → kontak admin cepat
• *RESELLER* → info paket reseller
`)
}

async function adminHandler({ client, msg }) {
  return client.sendMessage(msg.from, '📞 *Kontak Admin:* 083129999931')
}

async function websiteHandler({ client, msg }) {
  return client.sendMessage(msg.from, '🌐 https://digitalpanelsmm.com')
}

async function resellerHandler({ client, msg }) {
  const userId = msg.from

  try {
    const activeRecord = await resellerService.getResellerRecord(userId)
    const header = buildHeader('Program Reseller')

    if (activeRecord) {
      return client.sendMessage(userId,
`${header}✅ Status: *Reseller Aktif*
Tipe: *${activeRecord.type}*
Berlaku hingga: *${formatExpiry(activeRecord.expired_at)}*

Untuk perpanjangan, ketik *GABUNG 1/2/3*.

📞 *Chat Admin:* 083129999931`
      )
    }

    return client.sendMessage(userId,
`${header}✅ Harga lebih kompetitif
✅ Komisi otomatis
✅ Support 24/7

*Cara daftar:*
1. Ketik *GABUNG* untuk melihat paket
2. Pilih paket dengan *GABUNG 1/2/3*
3. Bayar tagihan reseller

📌 Paket reseller:
• *GABUNG 1* → 1 Bulan (Rp 10.000)
• *GABUNG 2* → 12 Bulan (Rp 50.000)
• *GABUNG 3* → Unlimited (Rp 100.000)

📞 *Chat Admin:* 083129999931`
    )
  } catch (error) {
    logError('Reseller handler failed', error)
    return client.sendMessage(userId, '❌ Gagal memuat informasi reseller. Silakan coba lagi nanti.')
  }
}

async function stockHandler({ client, msg }) {
  try {
    const [response, isReseller] = await Promise.all([
      premku.getProducts(API_KEY),
      resellerService.isReseller(msg.from)
    ])

    const products = Array.isArray(response.products) ? response.products.slice() : []
    const availableProducts = products
      .filter(product => product && Number(product.stock) > 0)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id-ID'))

    if (!availableProducts.length) {
      return client.sendMessage(msg.from, '🔎 Maaf, stok produk belum tersedia saat ini.')
    }

    let message = `${buildHeader('Katalog Premiumin Plus')}`

    availableProducts.forEach(product => {
      const name = product.name || 'Produk Premium'
      const stock = Number(product.stock) || 0
      const price = calculateSalePrice(Number(product.price) || 0, isReseller)
      const code = product.id || '-'
      message += `📦 *${name}*\n`
      message += `📊 Stok: ${stock} Akun\n`
      message += `💰 Rp ${formatCurrency(price)}${isReseller ? ' (harga reseller)' : ''}\n`
      message += `🔑 Code: buy ${code}\n\n`
    })

    message += `━━━━━━━━━━━━━━━\n`
    message += `📌 *Cara Order:*\n`
    message += `Ketik: buy [kode]\n`
    message += `Contoh: buy 14\n`
    if (!isReseller) {
      message += `\n✳️ Ingin harga reseller? Ketik *GABUNG 1/2/3* untuk bergabung.\n`
    }

    return client.sendMessage(msg.from, message)
  } catch (error) {
    logError('Failed to fetch stock', error)
    return client.sendMessage(msg.from, '❌ Gagal mengambil stok produk. Silakan coba lagi sebentar.')
  }
}

async function buyHandler({ client, msg }, args) {
  const productId = parseId(args)
  if (!productId) {
    return client.sendMessage(msg.from, '❌ Format salah. Gunakan: *BUY 1* atau *BUY1*')
  }

  try {
    const [productsResponse, isReseller] = await Promise.all([
      premku.getProducts(API_KEY),
      resellerService.isReseller(msg.from)
    ])

    const product = (productsResponse.products || []).find(item => item.id === productId)
    if (!product) {
      return client.sendMessage(msg.from, '❌ Produk tidak ditemukan. Coba lagi dengan ID yang benar.')
    }

    const basePrice = calculateSalePrice(Number(product.price) || 0, isReseller)
    const invoiceId = buildInvoiceId()

    const paymentResponse = await payment.createDeposit(API_KEY, basePrice)
    const payData = paymentResponse.data || paymentResponse
    if (!payData || !payData.invoice) {
      throw new Error('Respons pembayaran tidak valid')
    }

    const orderRecord = {
      invoice: invoiceId,
      user: msg.from,
      product_id: product.id,
      product_name: product.name,
      total: basePrice,
      status: 'WAITING',
      invoice_pay: payData.invoice,
      created_at: Date.now(),
      qr_message_id: null
    }

    await db.addOrder(orderRecord)

    const caption =
`${buildHeader('Tagihan Pembayaran')}

📦 Produk: *${product.name}*
💰 Total: *Rp ${formatCurrency(basePrice)}*
📄 Invoice: *${invoiceId}*

⚠️ Bayar tepat sesuai nominal
⏳ Batas waktu: 5 menit
🔄 Otomatis diproses setelah bayar

*Batal jika ingin membatalkan:*
cancel ${invoiceId}`

    const media = buildQrMedia(payData.qr_image)
    if (media) {
      const sent = await client.sendMessage(msg.from, media, { caption })
      if (sent && sent.id) {
        await db.updateOrder(invoiceId, { qr_message_id: sent.id._serialized || sent.id })
      }
      return sent
    }

    return client.sendMessage(msg.from,
`${caption}

💳 QRIS:
${payData.qr_raw || 'Tidak tersedia. Silakan ulangi.'}`
    )
  } catch (error) {
    logError('Buy handler failed', error)
    return client.sendMessage(msg.from, `❌ Gagal membuat pembayaran: ${error.message}`)
  }
}

async function joinResellerHandler({ client, msg }, args) {
  const userId = msg.from
  const planId = parseId(args)

  if (!planId) {
    return client.sendMessage(userId,
`${buildHeader('JOIN RESELLER PREMIUMIN PLUS')}

1. 1 Bulan - 10.000
2. 12 Bulan - 50.000
3. Unlimited - 100.000

Ketik: gabung 1 / 2 / 3`
    )
  }

  const plan = RESELLER_PLANS[String(planId)]
  if (!plan) {
    return client.sendMessage(userId, '❌ Paket reseller tidak valid. Pilih 1, 2, atau 3.')
  }

  try {
    const activeRecord = await resellerService.getResellerRecord(userId)
    const invoiceId = buildInvoiceId()
    const paymentResponse = await payment.createDeposit(API_KEY, plan.price)
    const payData = paymentResponse.data || paymentResponse
    if (!payData || !payData.invoice) {
      throw new Error('Respons pembayaran tidak valid')
    }

    await resellerService.createPendingRequest(userId, planId, plan.price, payData.invoice, invoiceId)

    const caption =
`${buildHeader('Tagihan Reseller')}

📦 Paket: *${plan.label}*
💰 Total: *Rp ${formatCurrency(plan.price)}*
📄 Invoice: *${invoiceId}*

⚠️ Bayar tepat sesuai nominal
⏳ Reseller aktif otomatis setelah pembayaran dikonfirmasi

*Batal jika ingin membatalkan:*
cancel ${invoiceId}`

    const note = activeRecord ? `\n\nℹ️ Paket akan memperpanjang durasi reseller yang sudah aktif.` : ''
    const media = buildQrMedia(payData.qr_image)
    if (media) {
      return client.sendMessage(userId, media, { caption: `${caption}${note}` })
    }

    return client.sendMessage(userId,
`${caption}${note}

💳 QRIS:
${payData.qr_raw || 'Tidak tersedia. Silakan ulangi.'}`
    )
  } catch (error) {
    logError('Join reseller failed', error)
    return client.sendMessage(userId, `❌ Gagal membuat tagihan reseller: ${error.message}`)
  }
}

async function cancelHandler({ client, msg }, args) {
  const invoice = args[0] ? args[0].toString().trim().toUpperCase() : null
  if (!invoice || !invoice.startsWith('INV-')) {
    return client.sendMessage(msg.from, '❌ Format cancel salah. Gunakan: *cancel INV-123456789*')
  }

  try {
    const order = await db.getOrder(invoice)
    if (order && order.user === msg.from) {
      if (order.status !== 'WAITING') {
        return client.sendMessage(msg.from, `❌ Status invoice: ${order.status}. Tidak bisa dibatalkan.`)
      }

      const cancelResult = await payment.cancelDeposit(API_KEY, order.invoice_pay)
      const success = cancelResult?.success === true || cancelResult?.status === 'success' || String(cancelResult?.message || '').toLowerCase().includes('batal')
      if (!success) {
        return client.sendMessage(msg.from, '❌ Pembatalan gagal. Silakan coba lagi nanti.')
      }

      await db.updateOrder(invoice, { status: 'CANCELLED' })
      return client.sendMessage(msg.from, `✅ Pesanan ${invoice} berhasil dibatalkan.`)
    }

    const pendingRequests = await resellerService.getPendingRequests()
    const request = pendingRequests.find(entry => entry.invoice === invoice && entry.id === msg.from)
    if (request) {
      const cancelResult = await payment.cancelDeposit(API_KEY, request.invoice_pay)
      const success = cancelResult?.success === true || cancelResult?.status === 'success' || String(cancelResult?.message || '').toLowerCase().includes('batal')
      if (!success) {
        return client.sendMessage(msg.from, '❌ Pembatalan gagal. Silakan coba lagi nanti.')
      }

      await resellerService.failPendingRequest(request.invoice_pay)
      return client.sendMessage(msg.from, `✅ Tagihan reseller ${invoice} berhasil dibatalkan.`)
    }

    return client.sendMessage(msg.from, '❌ Invoice tidak ditemukan atau bukan milik Anda.')
  } catch (error) {
    logError('Cancel handler failed', error)
    return client.sendMessage(msg.from, `❌ Gagal membatalkan invoice: ${error.message}`)
  }
}

function parseId(args) {
  if (!args || !args.length) return null
  const arg = String(args[0] || '').trim()
  const numeric = arg.replace(/[^0-9]/g, '')
  return numeric ? Number(numeric) : null
}

async function handleCommand(client, msg) {
  const userId = msg.from
  const body = msg.body ? msg.body.toLowerCase().trim() : ''
  const { logInfo, logError } = require('../utils/logger')
  
  logInfo('[COMMAND EXEC]', { userId, body })
  
  try {
    const text = sanitizeText(msg.body).toLowerCase()
    const { command, args } = parseCommand(text)

    switch (command) {
      case 'menu':
        return menuHandler({ client, msg })
      case 'stock':
      case 'stok':
        return stockHandler({ client, msg })
      case 'buy':
        return buyHandler({ client, msg }, args)
      case 'join':
      case 'gabung':
        return joinResellerHandler({ client, msg }, args)
      case 'reseller':
        return resellerHandler({ client, msg })
      case 'cancel':
        return cancelHandler({ client, msg }, args)
      case 'admin':
        return adminHandler({ client, msg })
      case 'website':
        return websiteHandler({ client, msg })
      case 'ping':
      case 'p':
        return greetingHandler({ client, msg })
      default:
        return client.sendMessage(msg.from, '🤖 Perintah tidak dikenali. Ketik *MENU* untuk daftar perintah.')
    }
  } catch (error) {
    logError('Command handler error', { userId, error: error.message })
    return client.sendMessage(userId, '⚠️ Terjadi error pada command, coba lagi.')
  }
}

module.exports = {
  handleCommand
}
