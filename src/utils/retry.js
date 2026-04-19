const { logRetry } = require('./logger')
const { RETRY_LIMIT, RETRY_DELAY } = require('../config')

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function retry(fn, maxRetry = RETRY_LIMIT, delay = RETRY_DELAY) {
  let attempt = 1
  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxRetry) {
        throw error
      }

      logRetry('Retry attempt failed', {
        attempt,
        maxRetry,
        error: error.message
      })

      await wait(delay)
      attempt += 1
    }
  }
}

module.exports = {
  retry
}
