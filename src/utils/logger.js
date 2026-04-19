const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const path = require('path')
const { LOG_LEVEL } = require('../config/index')

const logDir = path.join(process.cwd(), 'logs')
const logFile = path.join(logDir, 'app-%DATE%.log')

const logger = winston.createLogger({
  level: LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'WhatsAppBotPremiuminPlus' },
  transports: [
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d'
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

const logInfo = (message, meta = {}) => logger.info(message, meta)
const logWarn = (message, meta = {}) => logger.warn(message, meta)
const logError = (message, meta = {}) => logger.error(message, meta)
const logRetry = (message, meta = {}) => logger.warn(`[RETRY] ${message}`, meta)

module.exports = {
  logInfo,
  logWarn,
  logError,
  logRetry
}

