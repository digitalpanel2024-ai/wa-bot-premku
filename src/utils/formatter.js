const { MessageMedia } = require('whatsapp-web.js')

function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID').format(amount)
}

function formatExpiry(timestamp) {
  if (!timestamp) return 'Unlimited'
  const date = new Date(timestamp)
  return date.toLocaleDateString('id-ID', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

function parseBase64Image(base64Str) {
  if (!base64Str) return null
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
  if (matches) {
    return {
      mime: matches[1],
      data: matches[2]
    }
  }
  return null
}

function buildQrMedia(qrImage) {
  const parsed = parseBase64Image(qrImage)
  if (!parsed) return null
  return new MessageMedia(parsed.mime, parsed.data, 'qrcode.png')
}

function buildProductList(products, isReseller) {
  return products.map(p => `📦 *${p.name}*\n💰 Rp ${formatCurrency(p.price)}\n📊 Stok: ${p.stock}\n🔑 buy ${p.id}`).join('\n\n')
}

module.exports = {
  formatCurrency,
  formatExpiry,
  buildQrMedia,
  parseBase64Image,
  buildProductList
}
