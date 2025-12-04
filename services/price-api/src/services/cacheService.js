/**
 * Redis cache service layer
 */

const redis = require('redis')
const config = require('../utils/config')
const logger = require('../utils/logger')

class CacheService {
  constructor() {
    this.client = null
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      // Build Redis URL with password if provided
      let redisUrl = config.REDIS_URL
      if (config.REDIS_PASSWORD && !redisUrl.includes('@')) {
        redisUrl = `redis://:${config.REDIS_PASSWORD}@${config.REDIS_HOST}:${config.REDIS_PORT}`
      }
      
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      })

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err)
      })

      this.client.on('connect', () => {
        logger.info('Connected to Redis')
      })

      this.client.on('disconnect', () => {
        logger.warn('Disconnected from Redis')
      })

      await this.client.connect()
      logger.info('Redis cache service initialized')
    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error)
      // Don't throw error - allow service to continue without cache
      this.client = null
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable() {
    return this.client && this.client.isOpen
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isAvailable()) return false
      
      await this.client.ping()
      return true
    } catch (error) {
      logger.error('Redis health check failed:', error)
      return false
    }
  }

  /**
   * Get cached price data
   */
  async getPrice(symbol) {
    try {
      if (!this.isAvailable()) return null
      
      const key = `price:${symbol.toUpperCase()}:latest`
      const cached = await this.client.get(key)
      
      if (cached) {
        return JSON.parse(cached)
      }
      
      return null
    } catch (error) {
      logger.error(`Cache error getting price for ${symbol}:`, error)
      return null // Fail gracefully
    }
  }

  /**
   * Set cached price data
   */
  async setPrice(symbol, priceData, ttlSeconds = 900) {
    try {
      if (!this.isAvailable()) return
      
      const key = `price:${symbol.toUpperCase()}:latest`
      const data = JSON.stringify({
        ...priceData,
        cachedAt: new Date().toISOString()
      })
      
      await this.client.setEx(key, ttlSeconds, data)
    } catch (error) {
      logger.error(`Cache error setting price for ${symbol}:`, error)
      // Don't throw - cache errors shouldn't break the API
    }
  }

  /**
   * Get cached historical prices
   */
  async getHistoricalPrices(cacheKey) {
    try {
      if (!this.isAvailable()) return null
      
      const key = `historical:${cacheKey}`
      const cached = await this.client.get(key)
      
      if (cached) {
        return JSON.parse(cached)
      }
      
      return null
    } catch (error) {
      logger.error(`Cache error getting historical prices for ${cacheKey}:`, error)
      return null
    }
  }

  /**
   * Set cached historical prices
   */
  async setHistoricalPrices(cacheKey, data, ttlSeconds = 3600) {
    try {
      if (!this.isAvailable()) return
      
      const key = `historical:${cacheKey}`
      const cacheData = JSON.stringify({
        ...data,
        cachedAt: new Date().toISOString()
      })
      
      await this.client.setEx(key, ttlSeconds, cacheData)
    } catch (error) {
      logger.error(`Cache error setting historical prices for ${cacheKey}:`, error)
    }
  }

  /**
   * Delete cached data
   */
  async deletePrice(symbol) {
    try {
      if (!this.isAvailable()) return
      
      const key = `price:${symbol.toUpperCase()}:latest`
      await this.client.del(key)
    } catch (error) {
      logger.error(`Cache error deleting price for ${symbol}:`, error)
    }
  }

  /**
   * Clear cache matching pattern
   */
  async clearCache(pattern = 'price:*') {
    try {
      if (!this.isAvailable()) return 0
      
      const keys = await this.client.keys(pattern)
      
      if (keys.length > 0) {
        await this.client.del(keys)
        logger.info(`Cleared ${keys.length} cache entries matching '${pattern}'`)
        return keys.length
      }
      
      return 0
    } catch (error) {
      logger.error(`Cache error clearing pattern '${pattern}':`, error)
      return 0
    }
  }

  /**
   * Clear all sample data from cache
   */
  async clearSampleDataCache() {
    try {
      if (!this.isAvailable()) return 0
      
      let totalCleared = 0
      
      // Get all keys to see what's actually in Redis
      const allKeys = await this.client.keys('*')
      logger.info(`Found ${allKeys.length} total Redis keys:`, allKeys)
      
      // Clear price cache keys (price:SYMBOL:latest)
      const priceKeys = await this.client.keys('price:*')
      if (priceKeys.length > 0) {
        await this.client.del(priceKeys)
        totalCleared += priceKeys.length
        logger.info(`Cleared ${priceKeys.length} price cache entries:`, priceKeys)
      }
      
      // Clear historical cache keys (historical:SYMBOL:DAYSd:INTERVAL)
      const historicalKeys = await this.client.keys('historical:*')
      if (historicalKeys.length > 0) {
        await this.client.del(historicalKeys)
        totalCleared += historicalKeys.length
        logger.info(`Cleared ${historicalKeys.length} historical cache entries:`, historicalKeys)
      }
      
      // Also check for any other patterns that might contain sample data
      const otherKeys = allKeys.filter(key => 
        !key.startsWith('price:') && 
        !key.startsWith('historical:') &&
        !key.startsWith('__redis')
      )
      
      if (otherKeys.length > 0) {
        logger.info(`Found ${otherKeys.length} other keys that might contain sample data:`, otherKeys)
        // Clear these as well since they might be sample data related
        await this.client.del(otherKeys)
        totalCleared += otherKeys.length
        logger.info(`Cleared ${otherKeys.length} other cache entries`)
      }
      
      logger.info(`Total cache entries cleared: ${totalCleared}`)
      return totalCleared
    } catch (error) {
      logger.error('Cache error clearing sample data:', error)
      return 0
    }
  }

  /**
   * Clear cache entries matching a specific pattern
   */
  async clearPattern(pattern) {
    try {
      if (!this.isAvailable()) return 0
      
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
        logger.debug(`Cleared ${keys.length} cache entries matching pattern: ${pattern}`)
        return keys.length
      }
      return 0
    } catch (error) {
      logger.error(`Failed to clear cache pattern ${pattern}:`, error)
      return 0
    }
  }

  /**
   * Clear cache for a specific symbol (all related entries)
   */
  async invalidateSymbolCache(symbol) {
    try {
      if (!this.isAvailable()) return 0
      
      const upperSymbol = symbol.toUpperCase()
      let totalCleared = 0
      
      // Clear all cache entries related to this symbol
      const patterns = [
        `price:${upperSymbol}:*`,           // Current prices
        `historical:${upperSymbol}:*`,      // Historical data
        `crypto:${upperSymbol}:*`          // Crypto data
      ]
      
      for (const pattern of patterns) {
        const cleared = await this.clearPattern(pattern)
        totalCleared += cleared
      }
      
      if (totalCleared > 0) {
        logger.info(`Cache invalidated for symbol: ${upperSymbol}, cleared ${totalCleared} entries`)
      }
      
      return totalCleared
    } catch (error) {
      logger.error(`Failed to invalidate cache for ${symbol}:`, error)
      return 0
    }
  }

  /**
   * Invalidate all cache (use with caution)
   */
  async invalidateAllCache() {
    try {
      if (!this.isAvailable()) return 0
      
      const keys = await this.client.keys('*')
      if (keys.length > 0) {
        await this.client.del(...keys)
        logger.info(`All cache invalidated, cleared ${keys.length} entries`)
        return keys.length
      }
      return 0
    } catch (error) {
      logger.error('Failed to invalidate all cache:', error)
      return 0
    }
  }

  /**
   * Clear cache for specific symbols (more targeted approach)
   */
  async clearSymbolCache(symbols) {
    try {
      if (!this.isAvailable()) return 0
      
      let totalCleared = 0
      
      for (const symbol of symbols) {
        const upperSymbol = symbol.toUpperCase()
        
        // Clear price cache for this symbol
        const priceKey = `price:${upperSymbol}:latest`
        const priceExists = await this.client.exists(priceKey)
        if (priceExists) {
          await this.client.del(priceKey)
          totalCleared++
          logger.info(`Cleared price cache for ${upperSymbol}`)
        }
        
        // Clear historical cache for this symbol
        const historicalPattern = `historical:${upperSymbol}:*`
        const historicalKeys = await this.client.keys(historicalPattern)
        if (historicalKeys.length > 0) {
          await this.client.del(historicalKeys)
          totalCleared += historicalKeys.length
          logger.info(`Cleared ${historicalKeys.length} historical cache entries for ${upperSymbol}:`, historicalKeys)
        }
      }
      
      logger.info(`Total cache entries cleared for symbols: ${totalCleared}`)
      return totalCleared
    } catch (error) {
      logger.error('Cache error clearing symbol cache:', error)
      return 0
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      if (!this.isAvailable()) {
        return { status: 'disconnected' }
      }

      const info = await this.client.info()
      const dbSize = await this.client.dbSize()
      
      return {
        status: 'connected',
        dbSize,
        memoryUsage: this.extractInfoValue(info, 'used_memory_human'),
        connectedClients: this.extractInfoValue(info, 'connected_clients'),
        keyspaceHits: this.extractInfoValue(info, 'keyspace_hits'),
        keyspaceMisses: this.extractInfoValue(info, 'keyspace_misses')
      }
    } catch (error) {
      logger.error('Error getting cache stats:', error)
      return {
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * Extract value from Redis info string
   */
  extractInfoValue(info, key) {
    const lines = info.split('\r\n')
    for (const line of lines) {
      if (line.startsWith(`${key}:`)) {
        return line.split(':')[1]
      }
    }
    return null
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.isAvailable()) {
      await this.client.quit()
      this.client = null
      logger.info('Redis cache connection closed')
    }
  }
}

module.exports = new CacheService()