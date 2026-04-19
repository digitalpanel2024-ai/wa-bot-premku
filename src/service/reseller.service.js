const fs = require('fs').promises
const path = require('path')
const { logInfo, logError } = require('../utils/logger')

const RESELLER_DB_PATH = path.join(process.cwd(), 'database', 'reseller.json')
let resellerCache = null
let cacheLoaded = false
let queue = Promise.resolve()

const DURATION = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000
}

async function runExclusive(task) {
  queue = queue.then(() => task(), () => task())
  return queue
}

async function ensureDatabaseFile() {
  try {
    await fs.mkdir(path.dirname(RESELLER_DB_PATH), { recursive: true })
    await fs.access(RESELLER_DB_PATH)
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(RESELLER_DB_PATH, '[]', 'utf8')
      return
    }
    throw error
  }
}

async function readDatabase() {
  try {
    await ensureDatabaseFile()
    const raw = await fs.readFile(RESELLER_DB_PATH, 'utf8')
    const parsed = raw.trim() ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    logError('Failed to read reseller database', error)
    return []
  }
}

async function writeDatabase(records) {
  const payload = JSON.stringify(records, null, 2)
  const tempPath = `${RESELLER_DB_PATH}.tmp`
  await fs.writeFile(tempPath, payload, 'utf8')
  await fs.rename(tempPath, RESELLER_DB_PATH)
}

async function loadCacheNoLock() {
  if (cacheLoaded && Array.isArray(resellerCache)) {
    return resellerCache
  }

  resellerCache = await readDatabase()
  cacheLoaded = true
  return resellerCache
}

async function loadCache() {
  return runExclusive(loadCacheNoLock)
}

async function saveCacheNoLock() {
  if (!Array.isArray(resellerCache)) {
    resellerCache = []
  }

  await writeDatabase(resellerCache)
}

async function saveCache() {
  return runExclusive(saveCacheNoLock)
}

function normalizeType(type) {
  const value = String(type || '').toLowerCase()
  if (value === '1' || value === 'monthly') return 'monthly'
  if (value === '2' || value === 'yearly') return 'yearly'
  if (value === '3' || value === 'unlimited') return 'unlimited'
  return null
}

function calculateExpiry(type, startAt = Date.now()) {
  if (type === 'monthly') return startAt + DURATION.monthly
  if (type === 'yearly') return startAt + DURATION.yearly
  return null
}

async function cleanExpiredNoLock() {
  await loadCacheNoLock()
  const now = Date.now()
  const beforeCount = resellerCache.length

  resellerCache = resellerCache.filter(entry => {
    if (entry.status !== 'active') return true
    if (entry.expired_at === null) return true
    return entry.expired_at > now
  })

  if (resellerCache.length !== beforeCount) {
    await saveCacheNoLock()
    logInfo('Cleaned expired reseller records', { removed: beforeCount - resellerCache.length })
  }

  return resellerCache
}

async function cleanExpired() {
  return runExclusive(cleanExpiredNoLock)
}

async function getPendingRequests() {
  return runExclusive(async () => {
    await loadCacheNoLock()
    return resellerCache.filter(entry => entry.status === 'pending')
  })
}

async function getResellerRecord(userId) {
  return runExclusive(async () => {
    await cleanExpiredNoLock()
    return resellerCache.find(entry => entry.status === 'active' && entry.id === userId) || null
  })
}

async function isReseller(userId) {
  const record = await getResellerRecord(userId)
  return Boolean(record)
}

async function getResellerType(userId) {
  const record = await getResellerRecord(userId)
  return record?.type || null
}

async function addResellerInternal(userId, type, price = null, invoice = null) {
  const normalizedType = normalizeType(type)
  if (!normalizedType) {
    throw new Error('Invalid reseller type')
  }

  await loadCacheNoLock()
  const now = Date.now()
  const existing = resellerCache.find(entry => entry.id === userId && entry.status === 'active')
  const startAt = existing && existing.expired_at && existing.expired_at > now ? existing.expired_at : now
  const expired_at = calculateExpiry(normalizedType, startAt)

  const activeRecord = {
    id: userId,
    type: normalizedType,
    expired_at,
    status: 'active',
    price,
    invoice,
    created_at: now,
    updated_at: now
  }

  resellerCache = resellerCache.filter(entry => !(entry.id === userId && entry.status === 'active'))
  resellerCache = resellerCache.filter(entry => !(entry.status === 'pending' && entry.id === userId))
  resellerCache.push(activeRecord)
  await saveCacheNoLock()

  logInfo('Added reseller member', { userId, type: normalizedType, expired_at })
  return activeRecord
}

async function addReseller(userId, type, price = null, invoice = null) {
  return runExclusive(async () => {
    return addResellerInternal(userId, type, price, invoice)
  })
}

async function removeReseller(userId) {
  return runExclusive(async () => {
    await loadCacheNoLock()
    const before = resellerCache.length
    resellerCache = resellerCache.filter(entry => entry.id !== userId)
    if (resellerCache.length !== before) {
      await saveCacheNoLock()
      logInfo('Removed reseller user', { userId })
    }
  })
}

async function createPendingRequest(userId, type, price, invoicePay, invoice) {
  return runExclusive(async () => {
    const normalizedType = normalizeType(type)
    if (!normalizedType) {
      throw new Error('Invalid reseller type')
    }

    await loadCacheNoLock()
    resellerCache = resellerCache.filter(entry => !(entry.status === 'pending' && (entry.id === userId || entry.invoice === invoice || entry.invoice_pay === invoicePay)))

    const request = {
      id: userId,
      type: normalizedType,
      price,
      status: 'pending',
      invoice_pay: invoicePay,
      invoice,
      created_at: Date.now()
    }

    resellerCache.push(request)
    await saveCache()
    logInfo('Created reseller pending request', { userId, type: normalizedType, price, invoice, invoicePay })
    return request
  })
}

async function findPendingRequestByInvoice(invoiceId) {
  return runExclusive(async () => {
    await loadCacheNoLock()
    return resellerCache.find(entry => entry.status === 'pending' && (entry.invoice_pay === invoiceId || entry.invoice === invoiceId)) || null
  })
}

async function completePendingRequest(invoiceId) {
  return runExclusive(async () => {
    await loadCacheNoLock()
    const request = resellerCache.find(entry => entry.status === 'pending' && (entry.invoice_pay === invoiceId || entry.invoice === invoiceId))
    if (!request) return null

    const activeRecord = await addResellerInternal(request.id, request.type, request.price, request.invoice)
    resellerCache = resellerCache.filter(entry => !(entry.status === 'pending' && (entry.invoice_pay === invoiceId || entry.invoice === invoiceId)))
    await saveCacheNoLock()

    logInfo('Reseller pending request completed', { userId: request.id, invoiceId })
    return activeRecord
  })
}

async function failPendingRequest(invoiceId) {
  return runExclusive(async () => {
    await loadCacheNoLock()
    const before = resellerCache.length
    resellerCache = resellerCache.filter(entry => !(entry.status === 'pending' && (entry.invoice_pay === invoiceId || entry.invoice === invoiceId)))
    if (resellerCache.length !== before) {
      await saveCacheNoLock()
      logInfo('Removed failed reseller request', { invoiceId })
    }
  })
}

module.exports = {
  addReseller,
  removeReseller,
  isReseller,
  getResellerType,
  getResellerRecord,
  cleanExpired,
  createPendingRequest,
  getPendingRequests,
  findPendingRequestByInvoice,
  completePendingRequest,
  failPendingRequest
}
