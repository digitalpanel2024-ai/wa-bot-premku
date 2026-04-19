const { logInfo, logError } = require('./logger')
const { QUEUE_CONCURRENCY } = require('../config')

const queue = []
let processingCount = 0

async function processQueue() {
  if (processingCount >= QUEUE_CONCURRENCY) return

  while (queue.length > 0 && processingCount < QUEUE_CONCURRENCY) {
    const job = queue.shift()
    processingCount++
    try {
      logInfo('Processing queued message', { from: job.msg.from, body: job.msg.body })
      await job.handler(job.client, job.msg)
    } catch (error) {
      logError('Queue job failed', { error: error.message, from: job.msg.from })
    } finally {
      processingCount--
    }
  }

  // Continue processing if more jobs arrived
  if (queue.length > 0) {
    processQueue().catch(error => {
      logError('Queue processing failed', error)
    })
  }
}

function enqueue(client, msg, handler) {
  queue.push({ client, msg, handler })
  processQueue().catch(error => {
    logError('Queue processing failed', error)
  })
}

module.exports = {
  enqueue
}
