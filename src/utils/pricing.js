function getMarginPercentage(price, isReseller = false) {
  if (isReseller) {
    if (price <= 4999) return 0.35
    if (price <= 8999) return 0.30
    if (price <= 19999) return 0.15
    return 0.08
  }

  if (price <= 4999) return 0.79
  if (price <= 8999) return 0.56
  if (price <= 19999) return 0.19
  return 0.11
}

function getMargin(price, isReseller = false) {
  return getMarginPercentage(price, isReseller)
}

function calculateSalePrice(basePrice, isReseller = false) {
  const margin = getMargin(basePrice, isReseller)
  return Math.ceil(basePrice + basePrice * margin)
}

function buildUniqueTotal(basePrice, existingTotals) {
  let attempts = 0
  while (attempts < 20) {
    const uniqueCode = 100 + Math.floor(Math.random() * 300)
    const total = basePrice + uniqueCode
    if (!existingTotals.has(total)) {
      return {
        total,
        code: uniqueCode
      }
    }
    attempts += 1
  }

  const fallbackCode = 100
  return {
    total: basePrice + fallbackCode,
    code: fallbackCode
  }
}

module.exports = {
  getMarginPercentage,
  getMargin,
  calculateSalePrice,
  buildUniqueTotal
}
