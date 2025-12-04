const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const config = require('./config')
const logger = require('./utils/logger')
const pyramidStrategyRoutes = require('./routes/pyramidStrategy')
const PyramidStrategyService = require('./services/pyramidStrategyService')

const app = express()

// Security middleware
app.use(helmet())

// CORS middleware
app.use(cors(config.CORS))

// Compression middleware
app.use(compression())

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Routes
app.use('/api/v1/pyramid-strategy', pyramidStrategyRoutes)

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'pyramid-strategy',
        version: '1.0.0',
        description: 'Pyramid Strategy Service - 10 levels above and below highest price',
        endpoints: {
            health: '/api/v1/pyramid-strategy/health',
            levels: '/api/v1/pyramid-strategy/levels',
            config: '/api/v1/pyramid-strategy/config/levels',
            strategy: '/api/v1/pyramid-strategy/:symbol/status'
        }
    })
})

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    })

    res.status(500).json({
        success: false,
        error: 'Internal server error'
    })
})

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    })
})

const PORT = config.PORT

// Initialize pyramid strategy service
const pyramidService = new PyramidStrategyService()

app.listen(PORT, async () => {
    logger.info('Pyramid Strategy Service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    })

    console.log(`🚀 Pyramid Strategy Service running on port ${PORT}`)
    console.log(`📊 Health check: http://localhost:${PORT}/api/v1/pyramid-strategy/health`)
    console.log(`📈 Levels: http://localhost:${PORT}/api/v1/pyramid-strategy/levels`)

    // Initialize the service (this will start active monitoring)
    try {
        await pyramidService.initialize()
        logger.info('✅ Pyramid strategy service initialized with active monitoring')
    } catch (error) {
        logger.error('❌ Failed to initialize pyramid strategy service', { error: error.message })
    }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully')
    await pyramidService.shutdown()
    process.exit(0)
})

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully')
    await pyramidService.shutdown()
    process.exit(0)
})

module.exports = app




