# WhatsApp Automatic Bot

Bot WhatsApp otomatis untuk Premiumin Plus dengan optimasi performa dan kompatibilitas Railway.

## 🚀 Fitur

- ✅ Otomatisasi pembelian produk
- ✅ Integrasi payment gateway
- ✅ Sistem queue dengan concurrency control
- ✅ Auto reconnect WhatsApp
- ✅ Cache produk untuk performa
- ✅ Logging terstruktur
- ✅ Error handling global

## 🛠️ Optimasi yang Diterapkan

### 1. 🔥 Lazy Loading
- Module hanya di-load saat dibutuhkan
- Mengurangi memory usage saat startup

### 2. 🧠 Cache System
- Produk di-cache selama 5 menit
- Mengurangi API calls berulang

### 3. ⚡ Puppeteer Optimization
- Args ringan untuk Railway
- Memory usage minimal

### 4. 🧹 Clean Logging
- Level: info, warn, error
- Disable debug di production

### 5. 🔁 Global Retry System
- Max 3 retry untuk semua API calls
- Delay 2 detik antar retry

### 6. 🧵 Queue Optimization
- Concurrency = 1 untuk menghindari overload

### 7. 📦 Minimal Dependencies
- Hanya axios untuk HTTP
- whatsapp-web.js sudah include puppeteer

### 8. 🛡️ Safe Error Handling
- Global uncaughtException & unhandledRejection
- Auto restart jika crash

### 9. 📉 Async File System
- Semua I/O menggunakan async/await
- Tidak blocking main thread

### 10. 🌐 Railway Compatibility
- Gunakan PORT dari env
- Path.join() bukan absolute Windows path
- Session management robust

## 📋 Prerequisites

- Node.js 16+
- npm atau yarn
- API Key dari Premku
- Telegram Token (opsional)

## ⚙️ Konfigurasi

### Environment Variables (.env)

```env
# API Configuration
API_KEY=your_api_key_here
ENCRYPTED_API_KEY=
CRYPTO_SECRET=

# Telegram Configuration
TELEGRAM_TOKEN=your_telegram_token_here

# System Configuration
TIMEOUT=10000
RETRY_LIMIT=3
RETRY_DELAY=2000
QUEUE_CONCURRENCY=1
CACHE_REFRESH_INTERVAL=300000

# Railway Compatibility
PORT=3000

# Logging
LOG_LEVEL=info
```

### Railway Deployment

1. **Connect Repository**
   - Import project dari GitHub

2. **Environment Variables**
   - Set semua variable di atas di Railway dashboard

3. **Build Settings**
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Deploy**
   - Railway akan otomatis deploy
   - Bot akan start dan scan QR code

## 🏃‍♂️ Local Development

```bash
# Install dependencies
npm install

# Setup .env
cp .env.example .env
# Edit .env dengan API key

# Run bot
npm start
```

## 📊 Monitoring

Bot akan log aktivitas ke console:
- `[INFO]` - Informasi normal
- `[WARN]` - Peringatan
- `[ERROR]` - Error yang perlu perhatian

## 🔧 Troubleshooting

### Bot tidak connect ke WhatsApp
- Pastikan API_KEY valid
- Check logs untuk error puppeteer
- Restart Railway app

### Memory usage tinggi
- Bot sudah dioptimasi untuk Railway
- Jika masih tinggi, kurangi QUEUE_CONCURRENCY

### API calls gagal
- Check RETRY_LIMIT dan RETRY_DELAY
- Pastikan API_KEY valid

## 📝 Logs

Logs tersimpan di:
- Console output (Railway logs)
- File logs/status.log (local)

## 🤝 Support

Untuk support atau pertanyaan:
- Check Railway logs untuk error details
- Pastikan semua env variables sudah benar

---

**Happy Deploying! 🚀**
