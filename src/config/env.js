const path = require('path')
const dotenv = require('dotenv')

const envPath = path.join(process.cwd(), '.env')
dotenv.config({ path: envPath })

const parseIntOrDefault = (value, fallback) => {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

module.exports = {
  API_KEY: process.env.API_KEY || '',
  PREMKU_API_BASE_URL: process.env.PREMKU_API_BASE_URL || 'https://premku.com/api',
  PORT: parseIntOrDefault(process.env.PORT, 3000),
  SESSION_PATH: path.join(process.cwd(), 'sessions'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  TIMEOUT: parseIntOrDefault(process.env.TIMEOUT, 15000),
  RETRY_LIMIT: parseIntOrDefault(process.env.RETRY_LIMIT, 3),
  RETRY_DELAY: parseIntOrDefault(process.env.RETRY_DELAY, 3000),
  CACHE_REFRESH_INTERVAL: parseIntOrDefault(process.env.CACHE_REFRESH_INTERVAL, 300000)
}
