function getGreeting() {
    const h = new Date().getHours()

    if (h >= 4 && h < 10) return 'Selamat Pagi 🌅'
    if (h >= 10 && h < 15) return 'Selamat Siang ☀️'
    if (h >= 15 && h < 18) return 'Selamat Sore 🌆'
    return 'Selamat Malam 🌙'
}

function generateUniqueCode() {
    return Math.floor(Math.random() * (292 - 30 + 1)) + 30
}

function generateTrxId() {
    return 'TRX' + Date.now()
}

module.exports = {
    getGreeting,
    generateUniqueCode,
    generateTrxId
}