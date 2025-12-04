/**
 * Metrics controller for Prometheus monitoring
 */

const promClient = require('prom-client')
const config = require('../utils/config')
const databaseService = require('../services/databaseService')
const cacheService = require('../services/cacheService')

// Create a Registry to register the metrics
const register = new promClient.Registry()

// Add default metrics
promClient.collectDefaultMetrics({
  register,
  prefix: 'stock_api_'
})

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'stock_api_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
})

const httpRequestDuration = new promClient.Histogram({
  name: 'stock_api_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register]
})

const databaseConnectionsTotal = new promClient.Gauge({
  name: 'stock_api_database_connections_total',
  help: 'Total number of database connections',
  registers: [register]
})

const cacheHitsTotal = new promClient.Counter({
  name: 'stock_api_cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register]
})

const cacheMissesTotal = new promClient.Counter({
  name: 'stock_api_cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register]
})

const pricesServedTotal = new promClient.Counter({
  name: 'stock_api_prices_served_total',
  help: 'Total number of price requests served',
  labelNames: ['symbol', 'source'],
  registers: [register]
})

// Middleware to collect HTTP metrics
const collectHttpMetrics = (req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000
    const route = req.route ? req.route.path : req.path
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc()

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration)
  })

  next()
}

// Update database metrics
const updateDatabaseMetrics = async () => {
  try {
    const stats = await databaseService.getStats()
    if (stats && !stats.error) {
      databaseConnectionsTotal.set(stats.poolSize || 0)
    }
  } catch (error) {
    // Ignore errors in metrics collection
  }
}

// Update cache metrics
const updateCacheMetrics = async () => {
  try {
    const stats = await cacheService.getStats()
    if (stats && stats.keyspaceHits && stats.keyspaceMisses) {
      cacheHitsTotal.inc(parseInt(stats.keyspaceHits) || 0)
      cacheMissesTotal.inc(parseInt(stats.keyspaceMisses) || 0)
    }
  } catch (error) {
    // Ignore errors in metrics collection
  }
}

// Metrics endpoint handler
const getMetrics = async (req, res) => {
  try {
    // Update metrics before serving
    await updateDatabaseMetrics()
    await updateCacheMetrics()

    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
  } catch (error) {
    res.status(500).end('Error collecting metrics')
  }
}

// Start periodic metrics collection
if (config.ENABLE_METRICS) {
  setInterval(async () => {
    await updateDatabaseMetrics()
    await updateCacheMetrics()
  }, 30000) // Update every 30 seconds
}

module.exports = {
  getMetrics,
  collectHttpMetrics,
  metrics: {
    httpRequestsTotal,
    httpRequestDuration,
    databaseConnectionsTotal,
    cacheHitsTotal,
    cacheMissesTotal,
    pricesServedTotal
  }
}