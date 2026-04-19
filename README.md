# WhatsApp Bot Premiumin Plus

Production-grade WhatsApp bot integrated with Premku API, reseller system, queue, logging, Railway-ready.

## 🚀 Features

- ✅ Full Premku API (products/order/status/pay)
- ✅ Reseller membership (1bln/12bln/unlimited)
- ✅ Dynamic pricing (non-res +79/56/19/11%, res +35/30/15/8%)
- ✅ Queue system anti-collision
- ✅ Retry 3x, error handling
- ✅ File logging (logs/app.log)
- ✅ LocalAuth (QR once)
- ✅ Healthcheck /health
- ✅ Railway/VPS ready

## 📦 Commands

* `menu` - Menu
* `stok` - Katalog produk A-Z
* `buy <id>` - Beli produk
* `gabung` - Reseller packages
* `gabung <1|2|3>` - Bayar reseller
* `cancel <inv>` - Batal bayar
* `reseller` - Info reseller
* `admin` - Admin WA

## ⚙️ Install

```bash
git clone <repo>
cd WhatsAppAutomatic
npm install
```

## .env Setup

```bash
API_KEY=your_key
PORT=3000
LOG_LEVEL=info
```

## 🏃 Run

```bash
npm start
```

1. Scan QR (one-time)
2. Ready! Test `menu` `stok`

## 🌐 Deploy Railway

1. Connect repo to Railway
2. Set `API_KEY` env var
3. Deploy auto

## 📊 Monitor

- `curl localhost:3000/health`
- `tail -f logs/app.log`
- Queue/DB auto clean

## 🛠 Structure

```
src/
  service/ (wa, premku, payment, reseller, order.queue)
  utils/ (logger, retry, pricing, formatter)
  config/ env.js
handler/ (command, order, message)
database/ (reseller.json, orders.json)
logs/app.log
```

Production ready! No bug, stable, lightweight 🚀
