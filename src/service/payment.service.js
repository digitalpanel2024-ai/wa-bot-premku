const axios = require('axios')
const { retry } = require('../utils/retry')
const { logInfo } = require('../utils/logger')
const { API_KEY, TIMEOUT } = require('../config')

const client = axios.create({
  baseURL: 'https://premku.com/api',
  timeout: TIMEOUT
})

async function createDeposit(apiKey = API_KEY, amount) {
  return retry(async () => {
    const response = await client.post('/pay', { api_key: apiKey, amount })
    logInfo('Payment createDeposit', { status: response.status, amount })
    return response.data
  })
}

async function checkDeposit(apiKey = API_KEY, invoice) {
  return retry(async () => {
    const response = await client.post('/pay_status', { api_key: apiKey, invoice })
    logInfo('Payment checkDeposit', { status: response.status, invoice })
    return response.data
  })
}

async function cancelDeposit(apiKey = API_KEY, invoice) {
  return retry(async () => {
    const response = await client.post('/cancel_pay', { api_key: apiKey, invoice })
    logInfo('Payment cancelDeposit', { status: response.status, invoice })
    return response.data
  })
}

module.exports = {
  createDeposit,
  checkDeposit,
  cancelDeposit
}
