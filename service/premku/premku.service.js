const axios = require('axios')

const PREMKU_API_BASE = 'https://premku.com/api'
const client = axios.create({ baseURL: PREMKU_API_BASE, timeout: 10000 })

async function getProducts(apiKey) {
    const res = await client.post('/products', {
        api_key: apiKey
    })
    return res.data
}

async function createOrder(apiKey, product_id, qty, ref_id) {
    const res = await client.post('/order', {
        api_key: apiKey,
        product_id,
        qty,
        ref_id
    })
    return res.data
}

async function checkOrder(apiKey, invoice) {
    const res = await client.post('/status', {
        api_key: apiKey,
        invoice
    })
    return res.data
}

module.exports = {
    getProducts,
    createOrder,
    checkOrder
}