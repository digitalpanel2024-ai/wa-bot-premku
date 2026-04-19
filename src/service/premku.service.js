const axios = require('axios')
const { retryAsync } = require('../utils/retry')
const { logInfo, logError } = require('../utils/logger')
const { API_KEY, CACHE_REFRESH_INTERVAL } = require('../config')

const client = axios.create({
  baseURL: 'https://premku.com/api',
  timeout: 10000
})

let productsCache = null
let cacheTimestamp = 0

async function getProducts(apiKey = API_KEY) {
  const now = Date.now()
  if (productsCache && (now - cacheTimestamp) < CACHE_REFRESH_INTERVAL) {
    return productsCache
  }

  const data = await retryAsync(async () => {
    const response = await client.post('/products', { api_key: apiKey })
    logInfo('Premku getProducts', { status: response.status })
    return response.data
  })

  productsCache = data
  cacheTimestamp = now
  return data
}

async function getStock(apiKey = API_KEY, productId) {
  return retryAsync(async () => {
    const response = await client.post('/stock', { api_key: apiKey, product_id: productId })
    return response.data
  })
}

async function getProfile(apiKey = API_KEY) {
  return retryAsync(async () => {
    const response = await client.post('/profile', { api_key: apiKey })
    return response.data
  })
}

async function createOrder(apiKey, productId, quantity, refId) {
  return retryAsync(async () => {
    const response = await client.post('/order', {
      api_key: apiKey,
      product_id: productId,
      qty: quantity,
      ref_id: refId
    })
    logInfo('Premku createOrder', { status: response.status, refId })
    return response.data
  })
}

async function checkOrder(apiKey, invoice) {
  return retryAsync(async () => {
    const response = await client.post('/status', {
      api_key: apiKey,
      invoice
    })
    logInfo('Premku checkOrder', { status: response.status, invoice })
    return response.data
  })
}

module.exports = {
  getProducts,
  getStock,
  getProfile,
  createOrder,
  checkOrder
}
