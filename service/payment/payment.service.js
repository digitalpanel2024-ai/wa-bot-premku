const axios = require('axios')

async function createDeposit(apiKey, amount) {
    const res = await axios.post('https://premku.com/api/pay', {
        api_key: apiKey,
        amount
    })
    return res.data
}

async function checkDeposit(apiKey, invoice) {
    const res = await axios.post('https://premku.com/api/pay_status', {
        api_key: apiKey,
        invoice
    })
    return res.data
}

async function cancelDeposit(apiKey, invoice) {
    const res = await axios.post('https://premku.com/api/cancel_pay', {
        api_key: apiKey,
        invoice
    })
    return res.data
}

module.exports = {
    createDeposit,
    checkDeposit,
    cancelDeposit
}