/**
 * Stock Price API Service
 * Main application entry point
 */

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const rateLimit = require('express-rate-limit')

// Import utilities and configuration
const config = require('./src/utils/config')
const logger = require('./src/utils/logger')
const { connectDatabase } = require('./src/utils/database')

// Import middleware
const { errorHandler } = require('./src/middleware/errorHandler')
const requestLogger = require('./src/middleware/requestLogger')

// Import routes
const routes = require('./src/routes')

class StockPriceAPI {
  constructor() {
    this.app = express()
    this.server = null
  }

  async initialize() {
    try {
      logger.info('Initializing Stock Price API...')

      // Trust proxy for rate limiting behind nginx
      this.app.set('trust proxy', 1)
      
      // Security middleware
      this.app.use(helmet())
      
      // CORS configuration
      this.app.use(cors({
        origin: config.CORS_ORIGIN.split(','),
        credentials: config.CORS_CREDENTIALS === 'true',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
      }))

      // Compression
      this.app.use(compression())

      // Body parsing
      this.app.use(express.json({ limit: '10mb' }))
      this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))

      // Rate limiting
      const limiter = rateLimit({
        windowMs: config.RATE_LIMIT_WINDOW_MS,
        max: config.RATE_LIMIT_MAX_REQUESTS,
        message: {
          error: 'Too many requests',
          message: config.RATE_LIMIT_MESSAGE,
          retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
          // Skip rate limiting for health checks
          return req.path === '/health' || req.path === '/metrics'
        }
      })
      this.app.use(limiter)

      // Request logging
      if (config.NODE_ENV !== 'test') {
        this.app.use(requestLogger)
      }

      // Connect to database
      await connectDatabase()

      // Mount the real routes
      this.app.use(routes)

      // Temporary test - create a simple router
      const testRouter = express.Router()
      testRouter.get('/', (req, res) => {
        res.json({ message: 'Test route working' })
      })
      
      this.app.use('/', testRouter)

      // 404 handler
      this.app.use('*', (req, res) => {
        res.status(404).json({
          success: false,
          error: 'Endpoint not found',
          message: `Cannot ${req.method} ${req.originalUrl}`,
          timestamp: new Date().toISOString()
        })
      })

      // Error handling middleware (must be last)
      this.app.use(errorHandler)

      logger.info('Stock Price API initialized successfully')
      
    } catch (error) {
      logger.error('Failed to initialize API:', error)
      throw error
    }
  }

  async start() {
    try {
      await this.initialize()
      
      this.server = this.app.listen(config.API_PORT, config.API_HOST, () => {
        logger.info(`Stock Price API server running on ${config.API_HOST}:${config.API_PORT}`)
        logger.info(`Environment: ${config.NODE_ENV}`)
        logger.info(`API Documentation: http://${config.API_HOST}:${config.API_PORT}/api/docs`)
      })

      // Graceful shutdown handlers
      process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'))
      process.on('SIGINT', () => this.gracefulShutdown('SIGINT'))

    } catch (error) {
      logger.error('Failed to start server:', error)
      process.exit(1)
    }
  }

  async gracefulShutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`)
    
    if (this.server) {
      this.server.close(async () => {
        logger.info('HTTP server closed')
        
        try {
          // Close database connections
          const { closeDatabase } = require('./src/utils/database')
          await closeDatabase()
          
          logger.info('Graceful shutdown completed')
          process.exit(0)
        } catch (error) {
          logger.error('Error during graceful shutdown:', error)
          process.exit(1)
        }
      })

      // Force close after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout')
        process.exit(1)
      }, 10000)
    }
  }

  getApp() {
    return this.app
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const api = new StockPriceAPI()
  api.start()
}

module.exports = StockPriceAPI