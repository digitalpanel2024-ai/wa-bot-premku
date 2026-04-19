const { API_KEY } = require('../config')
const payment = require('../service/payment.service')
const premku = require('../service/premku.service')
const db = require('../database/db')
const { logInfo, logError } = require('../utils/logger')
const { formatCurrency } = require('../utils/format')

let isProcessingOrders = false
let isExpiringOrders = false

async function processPendingOrders(client) {
  if (isProcessingOrders) return
  isProcessingOrders = true

  try {
    const orders = await db.getActiveOrders()
    if (!orders.length) return

    for (const order of orders) {
      try {
        const paymentStatus = await payment.checkDeposit(API_KEY, order.invoice_pay)
        const status = paymentStatus.data?.status || paymentStatus.status || ''
        logInfo('Checking payment status', { invoice: order.invoice, status })

        if (status === 'success') {
          // Kirim notif sedang diproses
          await client.sendMessage(order.user, 
`✅ PEMBAYARAN BERHASIL

Terima kasih 🙏
Pembayaran kamu sudah kami terima.

⏳ Pesanan sedang diproses...`
          )
          // Update status ke processing
          await db.updateOrder(order.invoice, { status: 'PROCESSING' })
          // Mulai fulfill order
          fulfillOrder(client, order).catch(error => {
            logError('Fulfill order failed', { invoice: order.invoice, error: error.message })
          })
        } else if (status === 'expired' || status === 'failed') {
          await db.updateOrder(order.invoice, { status: 'EXPIRED' })
          await client.sendMessage(order.user, `⏳ Pesanan ${order.invoice} kedaluwarsa. Silakan buat ulang jika masih ingin membeli.`)
        }
      } catch (error) {
        logError('Payment check failed', { invoice: order.invoice, error: error.message })
      }
    }
  } finally {
    isProcessingOrders = false
  }
}

async function fulfillOrder(client, order) {
  try {
    const existing = await db.getOrder(order.invoice)
    if (!existing || existing.status !== 'PROCESSING') {
      logInfo('Skipping order fulfillment', { invoice: order.invoice, status: existing?.status })
      return
    }

    logInfo('Starting order fulfillment', { invoice: order.invoice, productId: order.product_id })

    // Step 1: Create order
    const orderResponse = await premku.createOrder(API_KEY, order.product_id, 1, order.invoice)
    logInfo('Order creation response', { invoice: order.invoice, response: orderResponse })

    if (!orderResponse || !orderResponse.invoice) {
      throw new Error(`Order creation failed: Invalid response - ${JSON.stringify(orderResponse)}`)
    }

    const orderInvoice = orderResponse.invoice
    logInfo('Order created successfully', { invoice: order.invoice, orderInvoice })

    // Step 2: Polling for status with extended timeout
    const MAX_RETRY = 30 // Extended for slow APIs
    const DELAY = 5000 // 5 seconds
    let retries = 0
    let orderCompleted = false

    while (retries < MAX_RETRY && !orderCompleted) {
      try {
        logInfo('Polling order status', { invoice: order.invoice, orderInvoice, attempt: retries + 1 })
        const statusResponse = await premku.checkOrder(API_KEY, orderInvoice)
        logInfo('Status response', { invoice: order.invoice, statusResponse })

        const orderStatus = (statusResponse.status || '').toLowerCase()

        if (orderStatus === 'success') {
          logInfo('Order status success, processing accounts', { invoice: order.invoice })

          if (!statusResponse.accounts || !Array.isArray(statusResponse.accounts) || statusResponse.accounts.length === 0) {
            throw new Error(`No accounts received: ${JSON.stringify(statusResponse)}`)
          }

          const account = statusResponse.accounts[0]
          if (!account || !account.username) {
            throw new Error(`Invalid account data: ${JSON.stringify(account)}`)
          }

          await deliverAccount(client, order, account)
          orderCompleted = true
          return

        } else if (orderStatus === 'error' || orderStatus === 'failed' || orderStatus === 'cancelled') {
          throw new Error(`Order failed with status: ${orderStatus} - ${JSON.stringify(statusResponse)}`)
        } else if (orderStatus === 'processing' || orderStatus === 'pending' || orderStatus === 'waiting') {
          logInfo('Order still processing', { invoice: order.invoice, status: orderStatus, attempt: retries + 1 })
          retries++
          if (retries < MAX_RETRY) {
            await new Promise(resolve => setTimeout(resolve, DELAY))
          }
        } else {
          logInfo('Unknown order status, continuing polling', { invoice: order.invoice, status: orderStatus, response: statusResponse })
          retries++
          if (retries < MAX_RETRY) {
            await new Promise(resolve => setTimeout(resolve, DELAY))
          }
        }
      } catch (pollError) {
        logError('Polling error', { invoice: order.invoice, error: pollError.message, attempt: retries + 1 })
        retries++
        if (retries >= MAX_RETRY) {
          break // Exit polling loop for background processing
        }
        await new Promise(resolve => setTimeout(resolve, DELAY))
      }
    }

    // If we reach here, polling timed out but order might still be processing
    if (!orderCompleted) {
      logInfo('Order polling timeout, moving to background processing', { invoice: order.invoice, orderInvoice })

      // Update order with orderInvoice for background worker
      await db.updateOrder(order.invoice, {
        status: 'PROCESSING',
        orderInvoice: orderInvoice
      })

      // Send processing message to user
      const processingMessage =
`⏳ *PESANAN SEDANG DIPROSES*

Estimasi 1-3 menit.
Akun akan dikirim otomatis setelah siap 😈

📄 Invoice: *${order.invoice}*`

      await client.sendMessage(order.user, processingMessage)
      logInfo('Order moved to background processing', { invoice: order.invoice })
      return
    }

  } catch (error) {
    logError('Order fulfillment failed', { invoice: order.invoice, error: error.message, stack: error.stack })

    // Send error message to user
    const errorMessage =
`⚠️ PEMBAYARAN BERHASIL

Namun terjadi kendala saat mengambil akun.
Admin akan segera membantu 🙏

📄 Invoice: *${order.invoice}*

*Detail Error:* ${error.message}`

    try {
      await client.sendMessage(order.user, errorMessage)
      logInfo('Error message sent to user', { invoice: order.invoice })
    } catch (msgError) {
      logError('Failed to send error message', { invoice: order.invoice, error: msgError.message })
    }

    // Update status to error
    await db.updateOrder(order.invoice, { status: 'ERROR' })
  }
}

async function deliverAccount(client, order, account) {
  const password = account.password || '-'
  const note = account.note || ''

  // Delete QR message
  try {
    if (order.qr_message_id && typeof client.deleteMessage === 'function') {
      await client.deleteMessage(order.user, order.qr_message_id, false)
      logInfo('QR message deleted', { invoice: order.invoice })
    }
  } catch (deleteError) {
    logError('Failed to remove QR message', { invoice: order.invoice, error: deleteError.message })
  }

  // Send success message
  const successMessage =
`✅ *PEMBAYARAN BERHASIL*\n\n📦 Produk: *${order.product_name}*\n💰 Total: Rp *${formatCurrency(order.total)}*\n\n📧 Username: ${account.username}\n🔑 Password: ${password}\n${note ? `\n📝 Catatan: ${note}` : ''}\n\n📄 Invoice: *${order.invoice}*\n\nTerima kasih telah menggunakan *Premiumin Plus* 🚀`

  await client.sendMessage(order.user, successMessage)
  db.updateOrder(order.invoice, { status: 'SUCCESS' })
  logInfo('Order fulfilled successfully', { invoice: order.invoice, username: account.username })
}

async function backgroundOrderWorker(client) {
  const orders = await db.listOrders()

  for (const order of orders) {
    if (order.status !== 'PROCESSING' || !order.orderInvoice) continue

    try {
      logInfo('Background worker checking order', { invoice: order.invoice, orderInvoice: order.orderInvoice })

      const statusResponse = await premku.checkOrder(API_KEY, order.orderInvoice)
      const orderStatus = (statusResponse.status || '').toLowerCase()

      if (orderStatus === 'success') {
        logInfo('Background worker found successful order', { invoice: order.invoice })

        if (!statusResponse.accounts || !Array.isArray(statusResponse.accounts) || statusResponse.accounts.length === 0) {
          logError('No accounts in background worker', { invoice: order.invoice, response: statusResponse })
          continue
        }

        const account = statusResponse.accounts[0]
        if (!account || !account.username) {
          logError('Invalid account in background worker', { invoice: order.invoice, account })
          continue
        }

        await deliverAccount(client, order, account)
        logInfo('Order delivered via background worker', { invoice: order.invoice })

      } else if (orderStatus === 'error' || orderStatus === 'failed' || orderStatus === 'cancelled') {
        logError('Order failed in background worker', { invoice: order.invoice, status: orderStatus })
        await db.updateOrder(order.invoice, { status: 'ERROR' })

        const errorMessage =
`⚠️ PESANAN GAGAL

Order tidak dapat diproses.
Silakan hubungi admin untuk bantuan.

📄 Invoice: *${order.invoice}*`

        await client.sendMessage(order.user, errorMessage)
      }
      // For 'processing' or 'pending', continue checking in next iteration

    } catch (error) {
      logError('Background worker error', { invoice: order.invoice, error: error.message })
    }
  }
}

async function expireOldOrders(client) {
  if (isExpiringOrders) return
  isExpiringOrders = true
  try {
    const orders = await db.getActiveOrders()
    const now = Date.now()

    for (const order of orders) {
      if (now - order.created_at > 5 * 60 * 1000) {
        await db.updateOrder(order.invoice, { status: 'EXPIRED' })
        await client.sendMessage(order.user, `⏳ Waktu pembayaran untuk ${order.invoice} telah berakhir. Silakan buat kembali jika masih ingin membeli.`)
        logInfo('Order expired due timeout', { invoice: order.invoice })
      }
    }
  } catch (error) {
    logError('Order expiration failed', error)
  } finally {
    isExpiringOrders = false
  }
}

function startOrderWatcher(client) {
  setInterval(() => {
    processPendingOrders(client).catch(error => logError('Pending order checker failed', error))
  }, 10 * 1000)

  setInterval(() => {
    backgroundOrderWorker(client).catch(error => logError('Background order worker failed', error))
  }, 10 * 1000) // Check every 10 seconds

  setInterval(() => {
    expireOldOrders(client).catch(error => logError('Order expiration failed', error))
  }, 60 * 1000)
}

module.exports = {
  startOrderWatcher
}
