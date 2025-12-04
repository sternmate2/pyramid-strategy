/**
 * Main routes configuration
 */

const express = require('express')
const router = express.Router()

// Import route modules
const healthRoutes = require('./health')
const priceRoutes = require('./prices')

// Import controllers
const metricsController = require('../controllers/metricsController')

// API documentation
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('../utils/swagger')

// Health and monitoring routes (no /api prefix)
router.use('/health', healthRoutes)
router.get('/metrics', metricsController.getMetrics)

// API documentation
router.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Main API routes (with /api/v1 prefix)
router.use('/api/v1', priceRoutes)

// API root endpoint
router.get('/api/v1', (req, res) => {
  res.json({
    name: 'Stock Price API',
    version: '1.0.0',
    description: 'Real-time stock price data API for anomaly detection',
    endpoints: {
      health: '/health',
      documentation: '/api/docs',
      prices: '/api/v1/prices',
      specific_price: '/api/v1/price/{symbol}',
      historical: '/api/v1/price/{symbol}/history'
    },
    timestamp: new Date().toISOString()
  })
})

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Stock Anomaly Detection System - Price API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/docs',
    health_check: '/health',
    timestamp: new Date().toISOString()
  })
})

module.exports = router