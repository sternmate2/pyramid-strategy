/**
 * Database connection utilities
 */

const databaseService = require('../services/databaseService')
const cacheService = require('../services/cacheService')
const logger = require('./logger')

/**
 * Initialize database connections
 */
async function connectDatabase() {
  try {
    logger.info('Connecting to database...')
    await databaseService.initialize()
    
    logger.info('Connecting to cache...')
    await cacheService.initialize()
    
    logger.info('Database connections established')
  } catch (error) {
    logger.error('Database connection failed:', error)
    throw error
  }
}

/**
 * Close database connections
 */
async function closeDatabase() {
  try {
    logger.info('Closing database connections...')
    
    await databaseService.close()
    await cacheService.close()
    
    logger.info('Database connections closed')
  } catch (error) {
    logger.error('Error closing database connections:', error)
    throw error
  }
}

/**
 * Database health check
 */
async function checkDatabaseHealth() {
  try {
    const dbHealthy = await databaseService.healthCheck()
    const cacheHealthy = await cacheService.healthCheck()
    
    return {
      database: dbHealthy,
      cache: cacheHealthy,
      overall: dbHealthy && cacheHealthy
    }
  } catch (error) {
    logger.error('Database health check error:', error)
    return {
      database: false,
      cache: false,
      overall: false,
      error: error.message
    }
  }
}

module.exports = {
  connectDatabase,
  closeDatabase,
  checkDatabaseHealth
}