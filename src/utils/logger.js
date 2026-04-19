const { LOG_LEVEL } = require('../config')

function formatPrefix(level) {
  const time = new Date().toISOString()
  return `[${level}] ${time}`
}

function logInfo(message, meta) {
  if (LOG_LEVEL === 'error') return
  if (meta !== undefined) {
    console.log(`${formatPrefix('INFO')} ${message}`, meta)
  } else {
    console.log(`${formatPrefix('INFO')} ${message}`)
  }
}

function logWarn(message, meta) {
  if (LOG_LEVEL === 'error') return
  if (meta !== undefined) {
    console.warn(`${formatPrefix('WARN')} ${message}`, meta)
  } else {
    console.warn(`${formatPrefix('WARN')} ${message}`)
  }
}

function logError(message, meta) {
  if (meta !== undefined) {
    console.error(`${formatPrefix('ERROR')} ${message}`, meta)
  } else {
    console.error(`${formatPrefix('ERROR')} ${message}`)
  }
}

function logRetry(message, meta) {
  logWarn(message, meta)
}

module.exports = {
  logInfo,
  logWarn,
  logError,
  logRetry
}
