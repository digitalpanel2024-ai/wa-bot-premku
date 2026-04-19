const axios = require('axios')
const { retryAsync } = require('../utils/retry')
const { logInfo, logError } = require('../utils/logger')
const { API_KEY, PREMKU_API_BASE_URL } = require('../config')

const client = axios.create({
  baseURL: PREMKU_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

async function createDeposit(apiKey = API_KEY, amount) {
  return retryAsync(async () => {
    const response = await client.post('/pay', { api_key: apiKey, amount })
    logInfo('Payment createDeposit', { invoice: response.data?.invoice })
    return response.data
  })
}

async function checkDepositStatus(apiKey = API_KEY, invoice) {
  return retryAsync(async () => {
    const response = await client.post('/pay_status', { api_key: apiKey, invoice })
    logInfo('Payment checkDepositStatus', { invoice, status: response.data?.status })
    return response.data
  })
}

async function cancelDeposit(apiKey = API_KEY, invoice) {
  return retryAsync(async () => {
    const response = await client.post('/cancel_pay', { api_key: apiKey, invoice })
    logInfo('Payment cancelDeposit', { invoice, success: response.data?.success })
    return response.data
  })
}

module.exports = {
  createDeposit,
  checkDepositStatus,
  cancelDeposit
}
