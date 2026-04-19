const { logInfo, logError } = require('../utils/logger')

class OrderQueue {
  constructor() {
    this.queue = []
    this.isProcessing = false
    this.maxConcurrency = 1
  }

  async add(task, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, priority, resolve, reject })
      this.queue.sort((a, b) => b.priority - a.priority)
      this.processNext()
    })
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    const job = this.queue.shift()

    try {
      const result = await job.task()
      job.resolve(result)
    } catch (error) {
      logError('Queue job failed', { error: error.message })
      job.reject(error)
    }

    this.isProcessing = false
    if (this.queue.length > 0) {
      this.processNext()
    }
  }
}

const orderQueue = new OrderQueue()

module.exports = { orderQueue }
