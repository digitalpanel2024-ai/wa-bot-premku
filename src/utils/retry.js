const { logRetry } = require('./logger')

async function retryAsync(fn, options = {}) {
  const maxRetries = options.retries || 3
  const minDelay = options.minDelay || 3000
  const maxDelay = options.maxDelay || 5000

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error
      }
      const waitMs = minDelay + Math.floor(Math.random() * (maxDelay - minDelay + 1))
      logRetry(`Attempt ${attempt} failed, retrying in ${waitMs}ms`, {
        error: error.message,
        attempt,
        retriesLeft: maxRetries - attempt
      })
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }
  }
}

module.exports = { retryAsync }
