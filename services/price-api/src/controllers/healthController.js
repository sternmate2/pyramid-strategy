/**
 * Health check controller
 */

const { StatusCodes } = require('http-status-codes')
const databaseService = require('../services/databaseService')
const cacheService = require('../services/cacheService')
const logger = require('../utils/logger')

class HealthController {
  /**
   * Basic health check
   */
  async healthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'stock-price-api',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV
      }

      res.json(health)
    } catch (error) {
      logger.error('Health check failed:', error)
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      })
    }
  }

  /**
   * Detailed health check including dependencies
   */
  async detailedHealthCheck(req, res) {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'stock-price-api',
      version: '1.0.0',
      dependencies: {}
    }

    let isHealthy = true

    try {
      // Check database connection
      try {
        const dbHealth = await databaseService.healthCheck()
        checks.dependencies.database = {
          status: dbHealth ? 'healthy' : 'unhealthy',
          responseTime: Date.now() // This would be properly measured in real implementation
        }
        if (!dbHealth) isHealthy = false
      } catch (error) {
        checks.dependencies.database = {
          status: 'unhealthy',
          error: error.message
        }
        isHealthy = false
      }

      // Check cache connection
      try {
        const cacheHealth = await cacheService.healthCheck()
        checks.dependencies.cache = {
          status: cacheHealth ? 'healthy' : 'unhealthy',
          responseTime: Date.now()
        }
        if (!cacheHealth) isHealthy = false
      } catch (error) {
        checks.dependencies.cache = {
          status: 'unhealthy', 
          error: error.message
        }
        isHealthy = false
      }

      // Overall status
      checks.status = isHealthy ? 'healthy' : 'unhealthy'
      checks.uptime = process.uptime()
      checks.memory = process.memoryUsage()

      const statusCode = isHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE
      res.status(statusCode).json(checks)

    } catch (error) {
      logger.error('Detailed health check failed:', error)
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      })
    }
  }

  /**
   * Readiness probe for Kubernetes
   */
  async readinessCheck(req, res) {
    try {
      // Check if all critical dependencies are ready
      const dbReady = await databaseService.healthCheck()
      const cacheReady = await cacheService.healthCheck()

      if (dbReady && cacheReady) {
        res.json({ status: 'ready' })
      } else {
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ 
          status: 'not ready',
          database: dbReady,
          cache: cacheReady
        })
      }
    } catch (error) {
      logger.error('Readiness check failed:', error)
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        status: 'not ready',
        error: error.message
      })
    }
  }

  /**
   * Liveness probe for Kubernetes
   */
  async livenessCheck(req, res) {
    // Simple liveness check - just return OK if the process is running
    res.json({ 
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  }
}

module.exports = new HealthController()