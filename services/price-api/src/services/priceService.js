/**
 * Price data service layer
 */

const databaseService = require('./databaseService')
const cacheService = require('./cacheService')
const logger = require('../utils/logger')

class PriceService {
  /**
   * Get latest price for a symbol with caching
   */
  async getLatestPrice(symbol) {
    try {
      // Check cache first
      const cachedPrice = await cacheService.getPrice(symbol)
      if (cachedPrice) {
        logger.debug(`Cache hit for ${symbol}`)
        return {
          ...cachedPrice,
          source: 'cache'
        }
      }

      // Cache miss - get from database
      logger.debug(`Cache miss for ${symbol}, fetching from database`)
      const price = await databaseService.getLatestPrice(symbol)
      
      if (price) {
        // Cache the result for 15 minutes
        await cacheService.setPrice(symbol, price, 900)
        return {
          ...price,
          source: 'database'
        }
      }

      return null
    } catch (error) {
      logger.error(`Error getting latest price for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get all latest prices
   */
  async getAllLatestPrices() {
    try {
      return await databaseService.getAllLatestPrices()
    } catch (error) {
      logger.error('Error getting all latest prices:', error)
      throw error
    }
  }

  /**
   * Get historical prices for a symbol with appropriate resolution
   */
  async getHistoricalPrices(symbol, days = 30, interval = '1d') {
    try {
      // Check cache for historical data
      const cacheKey = `${symbol}:${days}d:${interval}`
      const cachedData = await cacheService.getHistoricalPrices(cacheKey)
      
      if (cachedData) {
        logger.debug(`Historical cache hit for ${symbol}`)
        return cachedData
      }

      // Convert days to timeframe for database function
      let timeframe = '1m'  // default
      if (days <= 1) {
        timeframe = '1d'
      } else if (days <= 5) {
        timeframe = '5d'
      } else {
        timeframe = '1m'  // 30+ days use daily closing prices
      }

      // Check if this is a crypto symbol (contains slash)
      const isCrypto = symbol.includes('/')
      
      let prices
      if (isCrypto) {
        // Use crypto-specific method for crypto symbols
        logger.debug(`Getting crypto prices for ${symbol}`)
        prices = await databaseService.getCryptoPrices(symbol, days)
      } else {
        // Use new resolution-aware method for regular symbols
        logger.debug(`Getting stock prices for ${symbol} with timeframe ${timeframe}`)
        prices = await databaseService.getHistoricalPrices(symbol, days, timeframe)
      }
      
      if (prices && prices.length > 0) {
        const result = {
          symbol: symbol.toUpperCase(),
          period: `${days}d`,
          interval: interval,
          timeframe: timeframe,
          resolution: this._getResolutionDescription(timeframe),
          count: prices.length,
          prices: prices
        }

        // Cache for 1 hour
        await cacheService.setHistoricalPrices(cacheKey, result, 3600)
        
        return result
      }

      return null
    } catch (error) {
      logger.error(`Error getting historical prices for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get description of resolution based on timeframe
   */
  _getResolutionDescription(timeframe) {
    switch (timeframe) {
      case '1d': return '5-minute intervals'
      case '5d': return '30-minute intervals'
      default: return 'daily closing prices'
    }
  }

  /**
   * Get prices for multiple symbols
   */
  async getBulkPrices(symbols) {
    try {
      const results = {}
      const uncachedSymbols = []

      // Check cache for each symbol
      for (const symbol of symbols) {
        const cached = await cacheService.getPrice(symbol)
        if (cached) {
          results[symbol] = { ...cached, source: 'cache' }
        } else {
          uncachedSymbols.push(symbol)
        }
      }

      // Get uncached symbols from database
      if (uncachedSymbols.length > 0) {
        const dbPrices = await databaseService.getBulkPrices(uncachedSymbols)
        
        for (const [symbol, price] of Object.entries(dbPrices)) {
          results[symbol] = { ...price, source: 'database' }
          // Cache each result
          await cacheService.setPrice(symbol, price, 900)
        }
      }

      return results
    } catch (error) {
      logger.error('Error getting bulk prices:', error)
      throw error
    }
  }

  /**
   * Get all instruments
   */
  async getAllInstruments() {
    try {
      return await databaseService.getAllInstruments()
    } catch (error) {
      logger.error('Error getting all instruments:', error)
      throw error
    }
  }

  /**
   * Get instrument details
   */
  async getInstrument(symbol) {
    try {
      return await databaseService.getInstrument(symbol)
    } catch (error) {
      logger.error(`Error getting instrument ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get price statistics
   */
  async getPriceStatistics(symbol, days = 30) {
    try {
      const prices = await databaseService.getHistoricalPrices(symbol, days)
      
      if (!prices || prices.length === 0) {
        return null
      }

      const closePrices = prices.map(p => p.close).filter(p => p !== null)
      
      if (closePrices.length === 0) {
        return null
      }

      const min = Math.min(...closePrices)
      const max = Math.max(...closePrices)
      const avg = closePrices.reduce((a, b) => a + b, 0) / closePrices.length
      
      // Calculate standard deviation
      const variance = closePrices.reduce((sum, price) => 
        sum + Math.pow(price - avg, 2), 0) / closePrices.length
      const stdDev = Math.sqrt(variance)

      // Calculate volatility (standard deviation / average)
      const volatility = stdDev / avg

      return {
        symbol: symbol.toUpperCase(),
        period: `${days}d`,
        count: closePrices.length,
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
        average: Number(avg.toFixed(2)),
        standardDeviation: Number(stdDev.toFixed(2)),
        volatility: Number((volatility * 100).toFixed(2)), // as percentage
        priceChange: prices.length >= 2 ? 
          Number((closePrices[closePrices.length - 1] - closePrices[0]).toFixed(2)) : null,
        priceChangePercent: prices.length >= 2 ? 
          Number(((closePrices[closePrices.length - 1] - closePrices[0]) / closePrices[0] * 100).toFixed(2)) : null
      }
    } catch (error) {
      logger.error(`Error calculating price statistics for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get available stock symbols from database
   */
  async getAvailableStocks() {
    try {
      const stocks = await databaseService.getAvailableStocks()
      return stocks
    } catch (error) {
      logger.error('Error getting available stocks:', error)
      throw error
    }
  }

  /**
   * Populate database with sample price data for testing
   */
  async populateSampleData() {
    try {
      const result = await databaseService.populateSampleData()
      return result
    } catch (error) {
      logger.error('Error populating sample data:', error)
      throw error
    }
  }
  
  /**
   * Test database schema and constraints
   */
  async testDatabaseSchema() {
    try {
      const result = await databaseService.testDatabaseSchema()
      return result
    } catch (error) {
      logger.error('Error testing database schema:', error)
      throw error
    }
  }

  /**
   * Delete all sample data from database
   */
  async deleteSampleData() {
    try {
      // First delete from database
      const result = await databaseService.deleteSampleData()
      
      // Then clear from cache using targeted approach
      try {
        const cacheService = require('./cacheService')
        
        if (result.sample_data_symbols && result.sample_data_symbols.length > 0) {
          // Use targeted cache cleanup for specific symbols
          const clearedCacheEntries = await cacheService.clearSymbolCache(result.sample_data_symbols)
          logger.info(`Cleared ${clearedCacheEntries} cache entries for sample data symbols:`, result.sample_data_symbols)
          result.cleared_cache_entries = clearedCacheEntries
        } else {
          // Fallback to general cache cleanup if no symbols found
          const clearedCacheEntries = await cacheService.clearSampleDataCache()
          logger.info(`Cleared ${clearedCacheEntries} cache entries for sample data (fallback)`)
          result.cleared_cache_entries = clearedCacheEntries
        }
      } catch (cacheError) {
        logger.warn('Failed to clear cache during sample data deletion:', cacheError)
        result.cleared_cache_entries = 0
      }
      
      return result
    } catch (error) {
      logger.error('Error deleting sample data:', error)
      throw error
    }
  }

  /**
   * Get cryptocurrency price data
   */
  async getCryptoPrice(symbol, days = 30) {
    try {
      // Check cache first
      const cacheKey = `crypto:${symbol}:${days}d`
      const cachedData = await cacheService.getHistoricalPrices(cacheKey)
      
      if (cachedData) {
        logger.debug(`Crypto cache hit for ${symbol}`)
        return cachedData
      }

      // Get from database
      const prices = await databaseService.getCryptoPrices(symbol, days)
      
      if (prices && prices.length > 0) {
        const result = {
          symbol: symbol.toUpperCase(),
          period: `${days}d`,
          count: prices.length,
          prices: prices
        }

        // Cache for 5 minutes (crypto data changes frequently)
        await cacheService.setHistoricalPrices(cacheKey, result, 300)
        
        return result
      }

      return null
    } catch (error) {
      logger.error(`Error getting cryptocurrency price for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get volume analysis for all instruments
   */
  async getVolumeAnalysis(days = 30) {
    try {
      // Temporarily disable caching to debug the issue
      // const cacheKey = `volume_analysis:${days}d`
      // const cachedData = await cacheService.getHistoricalPrices(cacheKey)
      // 
      // if (cachedData) {
      //   logger.debug('Volume analysis cache hit')
      //   return cachedData
      // }

      logger.debug(`Getting fresh volume data for ${days} days`)
      const volumeData = await databaseService.getVolumeAnalysis(days)
      
      // Debug logging
      logger.debug(`Volume data from database: ${JSON.stringify(volumeData, null, 2)}`)
      logger.debug(`Volume data type: ${typeof volumeData}, Array: ${Array.isArray(volumeData)}, Length: ${volumeData?.length}`)
      
      // Ensure we return an array even if database returns null/undefined
      const safeVolumeData = Array.isArray(volumeData) ? volumeData : []
      logger.debug(`Safe volume data length: ${safeVolumeData.length}`)
      
      // Temporarily disable caching
      // await cacheService.setHistoricalPrices(cacheKey, safeVolumeData, 300)
      
      return safeVolumeData
    } catch (error) {
      logger.error('Error getting volume analysis:', error)
      throw error
    }
  }

  /**
   * Get volume history for a specific instrument
   */
  async getVolumeHistory(symbol, days = 30) {
    try {
      const cacheKey = `volume_history:${symbol}:${days}d`
      const cachedData = await cacheService.getHistoricalPrices(cacheKey)
      
      if (cachedData) {
        logger.debug(`Volume history cache hit for ${symbol}`)
        return cachedData
      }

      const volumeHistory = await databaseService.getVolumeHistory(symbol, days)
      
      const result = {
        symbol: symbol.toUpperCase(),
        period_days: days,
        data_points: volumeHistory.length,
        volume_history: volumeHistory
      }
      
      // Cache for 2 minutes for individual symbol volume history
      await cacheService.setHistoricalPrices(cacheKey, result, 120)
      
      return result
    } catch (error) {
      logger.error(`Error getting volume history for ${symbol}:`, error)
      throw error
    }
  }
}

module.exports = new PriceService()