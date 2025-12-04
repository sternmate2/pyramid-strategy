/**
 * Database service layer
 */

const { Pool } = require('pg')
const config = require('../utils/config')
const logger = require('../utils/logger')

class DatabaseService {
  constructor() {
    this.pool = null
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      this.pool = new Pool({
        connectionString: config.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      })

      // Test connection
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()

      logger.info('Database connection pool initialized')
    } catch (error) {
      logger.error('Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.pool) return false
      
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()
      return true
    } catch (error) {
      logger.error('Database health check failed:', error)
      return false
    }
  }

  /**
   * Get latest price for a symbol
   */
  async getLatestPrice(symbol) {
    try {
      const query = `
        SELECT symbol, date, open, high, low, close, volume, source, created_at, metadata
        FROM daily_prices 
        WHERE symbol = $1 
        ORDER BY date DESC, created_at DESC 
        LIMIT 1
      `
      
      const result = await this.pool.query(query, [symbol.toUpperCase()])
      
      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      return this.formatPriceData(row)
    } catch (error) {
      logger.error(`Database error getting latest price for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get all latest prices
   */
  async getAllLatestPrices() {
    try {
      const query = `
        SELECT DISTINCT ON (symbol) 
               symbol, date, open, high, low, close, volume, source, created_at, metadata
        FROM daily_prices 
        ORDER BY symbol, date DESC, created_at DESC
      `
      
      const result = await this.pool.query(query)
      return result.rows.map(row => this.formatPriceData(row))
    } catch (error) {
      logger.error('Database error getting all latest prices:', error)
      throw error
    }
  }

  /**
   * Get historical prices for a symbol with appropriate resolution based on timeframe
   */
  async getHistoricalPrices(symbol, days = 30, timeframe = '1m') {
    try {
      // Use the database function for appropriate resolution
      const query = `
        SELECT 
          ret_symbol as symbol,
          ret_timestamp as market_timestamp,
          ret_open as open,
          ret_high as high,
          ret_low as low,
          ret_close as close,
          ret_volume as volume,
          ret_source as source
        FROM get_price_data_by_timeframe($1, $2, $3)
        ORDER BY ret_timestamp ASC
      `
      
      const result = await this.pool.query(query, [symbol.toUpperCase(), timeframe, days])
      return result.rows.map(row => this.formatPriceData(row))
    } catch (error) {
      logger.error(`Database error getting historical prices for ${symbol} (${timeframe}):`, error)
      
      // Fallback to old method if function fails
      logger.info(`Falling back to daily prices for ${symbol}`)
      const fallbackQuery = `
        SELECT symbol, date, market_timestamp, open, high, low, close, volume, source, created_at, metadata
        FROM daily_prices 
        WHERE symbol = $1 
          AND market_timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
        ORDER BY market_timestamp ASC
      `
      
      const fallbackResult = await this.pool.query(fallbackQuery, [symbol.toUpperCase()])
      return fallbackResult.rows.map(row => this.formatPriceData(row))
    }
  }

  /**
   * Get bulk prices for multiple symbols
   */
  async getBulkPrices(symbols) {
    try {
      if (!symbols || symbols.length === 0) {
        return {}
      }

      const upperSymbols = symbols.map(s => s.toUpperCase())
      const placeholders = upperSymbols.map((_, i) => `${i + 1}`).join(',')
      
      const query = `
        SELECT DISTINCT ON (symbol) 
               symbol, date, open, high, low, close, volume, source, created_at, metadata
        FROM daily_prices 
        WHERE symbol IN (${placeholders})
        ORDER BY symbol, date DESC, created_at DESC
      `
      
      const result = await this.pool.query(query, upperSymbols)
      
      const prices = {}
      result.rows.forEach(row => {
        prices[row.symbol] = this.formatPriceData(row)
      })
      
      return prices
    } catch (error) {
      logger.error('Database error getting bulk prices:', error)
      throw error
    }
  }

  /**
   * Get all instruments
   */
  async getAllInstruments() {
    try {
      const query = `
        SELECT symbol, name, exchange, sector, industry, market_cap, metadata, created_at, updated_at
        FROM instruments 
        ORDER BY symbol
      `
      
      const result = await this.pool.query(query)
      return result.rows.map(row => this.formatInstrumentData(row))
    } catch (error) {
      logger.error('Database error getting all instruments:', error)
      throw error
    }
  }

  /**
   * Get instrument details
   */
  async getInstrument(symbol) {
    try {
      const query = `
        SELECT symbol, name, exchange, sector, industry, market_cap, metadata, created_at, updated_at
        FROM instruments 
        WHERE symbol = $1
      `
      
      const result = await this.pool.query(query, [symbol.toUpperCase()])
      
      if (result.rows.length === 0) {
        return null
      }

      return this.formatInstrumentData(result.rows[0])
    } catch (error) {
      logger.error(`Database error getting instrument ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Format price data for API response
   */
  formatPriceData(row) {
    return {
      symbol: row.symbol,
      date: row.date,
      open: row.open ? Number(row.open) : null,
      high: row.high ? Number(row.high) : null,
      low: row.low ? Number(row.low) : null,
      close: Number(row.close),
      volume: row.volume,
      source: row.source,
      timestamp: row.market_timestamp ? row.market_timestamp.toISOString() : row.created_at.toISOString(),
      metadata: row.metadata || {}
    }
  }

  /**
   * Format instrument data for API response
   */
  formatInstrumentData(row) {
    return {
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange,
      sector: row.sector,
      industry: row.industry,
      marketCap: row.market_cap,
      metadata: row.metadata || {},
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString()
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      logger.info('Database connection pool closed')
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const queries = [
        'SELECT COUNT(*) as instruments_count FROM instruments',
        'SELECT COUNT(*) as prices_count FROM daily_prices',
        'SELECT COUNT(*) as today_prices FROM daily_prices WHERE date = CURRENT_DATE'
      ]

      const results = await Promise.all(
        queries.map(query => this.pool.query(query))
      )

      return {
        instruments: Number(results[0].rows[0].instruments_count),
        totalPrices: Number(results[1].rows[0].prices_count),
        todayPrices: Number(results[2].rows[0].today_prices),
        poolSize: this.pool ? this.pool.totalCount : 0,
        idleConnections: this.pool ? this.pool.idleCount : 0
      }
    } catch (error) {
      logger.error('Error getting database stats:', error)
      return {
        error: error.message
      }
    }
  }

  /**
   * Get available stock symbols from database
   */
  async getAvailableStocks() {
    try {
      const query = `
        SELECT DISTINCT symbol 
        FROM daily_prices 
        ORDER BY symbol
      `
      
      const result = await this.pool.query(query)
      return result.rows.map(row => row.symbol)
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
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'IWM', 'SPY', 'QQQ', 'BTC/USD']
      let totalRecords = 0
      
      // First, ensure all symbols exist in the instruments table
      for (const symbol of symbols) {
        try {
          const isCrypto = symbol.includes('/') || ['BTC', 'ETH'].includes(symbol)
          
          if (isCrypto) {
            // Insert cryptocurrency instrument
            const instrumentQuery = `
              INSERT INTO instruments (symbol, name, exchange, sector, industry, instrument_type, is_24h_trading)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol) DO NOTHING
            `
            
            const instrumentValues = [
              symbol,
              `${symbol} Cryptocurrency`,
              'CRYPTO',
              'Cryptocurrency',
              'Digital Assets',
              'CRYPTO',
              true
            ]
            
            await this.pool.query(instrumentQuery, instrumentValues)
            logger.info(`Ensured cryptocurrency instrument ${symbol} exists`)
          } else {
            // Insert stock instrument
            const instrumentQuery = `
              INSERT INTO instruments (symbol, name, exchange, sector, industry, instrument_type, is_24h_trading)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol) DO NOTHING
            `
            
            const instrumentValues = [
              symbol,
              `${symbol} Stock`,
              'NASDAQ',
              'Technology',
              'Software',
              'STOCK',
              false
            ]
            
            await this.pool.query(instrumentQuery, instrumentValues)
            logger.info(`Ensured stock instrument ${symbol} exists`)
          }
        } catch (error) {
          logger.error(`Failed to ensure instrument ${symbol}:`, error.message)
          logger.error(`Full error:`, error)
        }
      }
      
      // Now generate sample price data
      for (const symbol of symbols) {
        try {
          const isCrypto = symbol.includes('/') || ['BTC', 'ETH'].includes(symbol)
          
          if (isCrypto) {
            // Generate cryptocurrency sample data
            await this._generateCryptoSampleData(symbol)
            totalRecords += 30 // Assume 30 records generated
          } else {
            // Generate stock sample data
            await this._generateStockSampleData(symbol)
            totalRecords += 30 // Assume 30 records generated
          }
          
        } catch (error) {
          logger.error(`Error generating sample data for ${symbol}:`, error)
        }
      }
      
      logger.info(`Sample data population completed. Inserted ${totalRecords} records for ${symbols.length} symbols.`)
      
      // Invalidate cache after data changes
      try {
        const clearedCount = await this.invalidateAllCache()
        logger.info(`Cache invalidated after sample data population, cleared ${clearedCount} entries`)
      } catch (cacheError) {
        logger.warn('Failed to invalidate cache after sample data population:', cacheError)
      }
      
      return {
        success: true,
        records: totalRecords,
        symbols: symbols
      }
    } catch (error) {
      logger.error('Error populating sample data:', error)
      throw error
    }
  }
  
  /**
   * Get base price for symbol (realistic starting prices)
   */
  getBasePrice(symbol) {
    const basePrices = {
      'AAPL': 150,
      'MSFT': 300,
      'GOOGL': 2500,
      'TSLA': 200,
      'AMZN': 3000,
      'IWM': 200,
      'SPY': 400,
      'QQQ': 350,
      'BTC/USD': 45000,
      'ETH': 3000
    }
    return basePrices[symbol] || 100
  }

  /**
   * Generate cryptocurrency sample data
   */
  async _generateCryptoSampleData(symbol) {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      let currentDate = new Date(startDate)
      let symbolRecords = 0
      
      while (currentDate <= endDate) {
        try {
          const basePrice = this.getBasePrice(symbol)
          const priceVariation = (Math.random() - 0.5) * 0.1 // 10% variation
          const price = basePrice * (1 + priceVariation)
          const volume = Math.floor(Math.random() * 1000000000) + 100000000
          const marketCap = price * volume * 0.1
          const priceChange = (Math.random() - 0.5) * 2000
          const priceChangePercent = (priceChange / price) * 100
          
          const query = `
            INSERT INTO crypto_prices (symbol, timestamp, price_usd, volume_24h, market_cap_usd, price_change_24h, price_change_percent_24h, source, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (symbol, timestamp) DO NOTHING
          `
          
          const values = [
            symbol,
            currentDate,
            price,
            volume,
            marketCap,
            priceChange,
            priceChangePercent,
            'SAMPLE_DATA',
            JSON.stringify({ source: 'sample_data', generated_at: new Date().toISOString() })
          ]
          
          const result = await this.pool.query(query, values)
          if (result.rowCount > 0) {
            symbolRecords++
          }
        } catch (error) {
          logger.error(`Failed to insert crypto sample data for ${symbol} on ${currentDate.toISOString().split('T')[0]}:`, error.message)
        }
        
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      logger.info(`Generated ${symbolRecords} crypto records for ${symbol}`)
    } catch (error) {
      logger.error(`Error generating crypto sample data for ${symbol}:`, error)
    }
  }

  /**
   * Generate stock sample data
   */
  async _generateStockSampleData(symbol) {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      let currentDate = new Date(startDate)
      let symbolRecords = 0
      
      while (currentDate <= endDate) {
        try {
          // Generate realistic price data that satisfies constraints
          const basePrice = this.getBasePrice(symbol)
          const open = basePrice + (Math.random() - 0.5) * 2
          const high = Math.max(open, open + Math.random() * 3)
          const low = Math.min(open, open - Math.random() * 2)
          const close = low + Math.random() * (high - low)
          const volume = Math.floor(Math.random() * 1000000) + 100000
          
          // Ensure all prices are positive and logical
          const finalOpen = Math.max(open, 0.01)
          const finalHigh = Math.max(high, finalOpen)
          const finalLow = Math.max(low, 0.01)
          const finalClose = Math.max(Math.min(close, finalHigh), finalLow)
          
          const query = `
            INSERT INTO daily_prices (symbol, date, open, high, low, close, volume, source, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (symbol, date) DO NOTHING
          `
          
          const values = [
            symbol,
            currentDate.toISOString().split('T')[0],
            finalOpen,
            finalHigh,
            finalLow,
            finalClose,
            volume,
            'SAMPLE_DATA',
            JSON.stringify({ source: 'sample_data', generated_at: new Date().toISOString() })
          ]
          
          const result = await this.pool.query(query, values)
          if (result.rowCount > 0) {
            symbolRecords++
          }
        } catch (error) {
          logger.error(`Failed to insert stock sample data for ${symbol} on ${currentDate.toISOString().split('T')[0]}:`, error.message)
        }
        
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      logger.info(`Generated ${symbolRecords} stock records for ${symbol}`)
    } catch (error) {
      logger.error(`Error generating stock sample data for ${symbol}:`, error)
    }
  }
  
  /**
   * Test database schema and constraints
   */
  async testDatabaseSchema() {
    try {
      logger.info('Testing database schema...')
      
      // Test 1: Check if instruments table exists and its structure
      try {
        const result = await this.pool.query(`
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'instruments' 
          ORDER BY ordinal_position
        `)
        logger.info('Instruments table structure:', result.rows)
      } catch (error) {
        logger.error('Failed to check instruments table structure:', error.message)
      }
      
      // Test 2: Check if daily_prices table exists and its structure
      try {
        const result = await this.pool.query(`
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'daily_prices' 
          ORDER BY ordinal_position
        `)
        logger.info('Daily_prices table structure:', result.rows)
      } catch (error) {
        logger.error('Failed to check daily_prices table structure:', error.message)
      }
      
      // Test 3: Try to insert a simple instrument
      try {
        const result = await this.pool.query(`
          INSERT INTO instruments (symbol, name, exchange, sector, industry)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (symbol) DO NOTHING
          RETURNING symbol
        `, ['TEST', 'Test Stock', 'TEST', 'Test', 'Test'])
        logger.info('Test instrument insertion result:', result.rows)
      } catch (error) {
        logger.error('Failed to insert test instrument:', error.message)
        logger.error('Full error:', error)
      }
      
      return { success: true }
    } catch (error) {
      logger.error('Database schema test failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete all sample data from database
   */
  async deleteSampleData() {
    try {
      logger.info('Deleting sample data from database...')
      
      // First, get symbols that have sample data before deleting
      const symbolsQuery = `
        SELECT DISTINCT symbol 
        FROM daily_prices 
        WHERE source = 'SAMPLE_DATA'
      `
      const symbolsResult = await this.pool.query(symbolsQuery)
      const sampleDataSymbols = symbolsResult.rows.map(row => row.symbol)
      logger.info(`Found ${sampleDataSymbols.length} symbols with sample data:`, sampleDataSymbols)
      
      // Delete all daily_prices with source = 'SAMPLE_DATA'
      const deletePricesQuery = `
        DELETE FROM daily_prices 
        WHERE source = 'SAMPLE_DATA'
      `
      const pricesResult = await this.pool.query(deletePricesQuery)
      const deletedPrices = pricesResult.rowCount
      logger.info(`Deleted ${deletedPrices} sample price records`)
      
      // Then, delete all instruments that were created for sample data
      // We'll identify them by checking if they have no remaining price data
      const deleteInstrumentsQuery = `
        DELETE FROM instruments 
        WHERE symbol IN (
          SELECT DISTINCT i.symbol 
          FROM instruments i 
          LEFT JOIN daily_prices dp ON i.symbol = dp.symbol 
          WHERE dp.symbol IS NULL
        )
      `
      const instrumentsResult = await this.pool.query(deleteInstrumentsQuery)
      const deletedInstruments = instrumentsResult.rowCount
      logger.info(`Deleted ${deletedInstruments} sample instruments`)
      
      logger.info(`Sample data deletion completed. Deleted ${deletedPrices} price records and ${deletedInstruments} instruments.`)
      
      // Invalidate cache after data changes
      try {
        const clearedCount = await this.invalidateAllCache()
        logger.info(`Cache invalidated after sample data deletion, cleared ${clearedCount} entries`)
      } catch (cacheError) {
        logger.warn('Failed to invalidate cache after sample data deletion:', cacheError)
      }
      
      return {
        deleted_instruments: deletedInstruments,
        deleted_prices: deletedPrices,
        sample_data_symbols: sampleDataSymbols
      }
    } catch (error) {
      logger.error('Error deleting sample data:', error)
      throw error
    }
  }

  /**
   * Invalidate cache for a specific symbol
   */
  async invalidateSymbolCache(symbol) {
    try {
      const cacheService = require('./cacheService')
      
      // Clear all cache entries related to this symbol
      const clearedCount = await cacheService.invalidateSymbolCache(symbol)
      
      logger.info(`Cache invalidated for symbol: ${symbol}, cleared ${clearedCount} entries`)
      return clearedCount
    } catch (error) {
      logger.warn(`Failed to invalidate cache for ${symbol}:`, error)
      return 0
    }
  }

  /**
   * Invalidate all cache (use with caution)
   */
  async invalidateAllCache() {
    try {
      const cacheService = require('./cacheService')
      const clearedCount = await cacheService.invalidateAllCache()
      
      logger.info(`All cache invalidated, cleared ${clearedCount} entries`)
      return clearedCount
    } catch (error) {
      logger.error('Failed to invalidate all cache:', error)
      return 0
    }
  }

  /**
   * Get cryptocurrency prices from database
   */
  async getCryptoPrices(symbol, days = 30) {
    try {
      const query = `
        SELECT 
          symbol,
          market_timestamp,
          price_usd,
          volume_24h,
          market_cap_usd,
          price_change_24h,
          price_change_percent_24h,
          source,
          metadata,
          created_at
        FROM crypto_prices 
        WHERE symbol = $1 
          AND market_timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY market_timestamp ASC
      `
      
      const result = await this.pool.query(query, [symbol.toUpperCase()])
      
      if (result.rows.length === 0) {
        logger.debug(`No crypto prices found for ${symbol} in last ${days} days`)
        return []
      }

      return result.rows.map(row => ({
        symbol: row.symbol,
        timestamp: row.market_timestamp.toISOString(),
        // Format crypto data to match stock price structure
        open: Number(row.price_usd), // Use price_usd as both open and close for crypto
        high: Number(row.price_usd), // Use price_usd as high for crypto
        low: Number(row.price_usd),  // Use price_usd as low for crypto
        close: Number(row.price_usd), // Use price_usd as close for crypto
        volume: row.volume_24h ? Number(row.volume_24h) : null,
        // Keep crypto-specific fields for reference
        price_usd: Number(row.price_usd),
        market_cap_usd: row.market_cap_usd ? Number(row.market_cap_usd) : null,
        price_change_24h: row.price_change_24h ? Number(row.price_change_24h) : null,
        price_change_percent_24h: row.price_change_percent_24h ? Number(row.price_change_percent_24h) : null,
        source: row.source,
        metadata: row.metadata || {},
        created_at: row.created_at.toISOString()
      }))
      
    } catch (error) {
      logger.error(`Error getting crypto prices for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get volume analysis for all instruments (generic for stocks and crypto)
   */
  async getVolumeAnalysis(days = 30) {
    try {
      const results = []
      
      // Get stock volume data (including records with NULL volume for fallback)
      const stockQuery = `
        SELECT 
          symbol,
          volume,
          market_timestamp,
          source
        FROM daily_prices 
        WHERE market_timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
        ORDER BY symbol, market_timestamp DESC
      `
      
      const stockResult = await this.pool.query(stockQuery)
      
      // Get crypto volume data (volume_24h field, including NULL for fallback)
      const cryptoQuery = `
        SELECT 
          symbol,
          volume_24h as volume,
          market_timestamp,
          source
        FROM crypto_prices 
        WHERE market_timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
        ORDER BY symbol, market_timestamp DESC
      `
      
      const cryptoResult = await this.pool.query(cryptoQuery)
      
      // Combine and process all instruments
      const allData = [
        ...stockResult.rows.map(row => ({ ...row, instrument_type: 'stock' })),
        ...cryptoResult.rows.map(row => ({ ...row, instrument_type: 'crypto' }))
      ]
      
      // Group by symbol and calculate statistics
      const symbolGroups = {}
      
      allData.forEach(row => {
        const symbol = row.symbol
        if (!symbolGroups[symbol]) {
          symbolGroups[symbol] = {
            symbol,
            instrument_type: row.instrument_type,
            volumes: [],
            latest_volume: null,
            latest_timestamp: null,
            source: row.source
          }
        }
        
        const volume = row.volume ? Number(row.volume) : null
        if (volume && volume > 0) {
          symbolGroups[symbol].volumes.push(volume)
          
          // Track latest volume
          if (!symbolGroups[symbol].latest_timestamp || 
              new Date(row.market_timestamp) > new Date(symbolGroups[symbol].latest_timestamp)) {
            symbolGroups[symbol].latest_volume = volume
            symbolGroups[symbol].latest_timestamp = row.market_timestamp
          }
        } else {
          // Even without volume, track the latest timestamp
          if (!symbolGroups[symbol].latest_timestamp || 
              new Date(row.market_timestamp) > new Date(symbolGroups[symbol].latest_timestamp)) {
            symbolGroups[symbol].latest_timestamp = row.market_timestamp
          }
        }
      })
      
      // Calculate statistics for each symbol
      Object.values(symbolGroups).forEach(group => {
        if (group.volumes.length > 0) {
          const volumes = group.volumes
          const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length
          const maxVolume = Math.max(...volumes)
          const minVolume = Math.min(...volumes)
          
          // Calculate volume trend (comparing latest to average)
          const volumeTrend = group.latest_volume && avgVolume > 0 
            ? ((group.latest_volume - avgVolume) / avgVolume * 100) 
            : 0
          
          results.push({
            symbol: group.symbol,
            instrument_type: group.instrument_type,
            current_volume: group.latest_volume,
            average_volume: Math.round(avgVolume),
            max_volume: maxVolume,
            min_volume: minVolume,
            volume_trend_percent: Number(volumeTrend.toFixed(2)),
            data_points: volumes.length,
            latest_timestamp: group.latest_timestamp?.toISOString(),
            source: group.source,
            period_days: days
          })
        } else {
          // Include symbols even without volume data (show as N/A)
          results.push({
            symbol: group.symbol,
            instrument_type: group.instrument_type,
            current_volume: null,
            average_volume: null,
            max_volume: null,
            min_volume: null,
            volume_trend_percent: 0,
            data_points: 0,
            latest_timestamp: group.latest_timestamp?.toISOString(),
            source: group.source,
            period_days: days,
            note: 'No volume data available - source may not provide volume'
          })
        }
      })
      
      // Sort by symbol
      results.sort((a, b) => a.symbol.localeCompare(b.symbol))
      
      logger.info(`Volume analysis completed for ${results.length} instruments over ${days} days`)
      return results
      
    } catch (error) {
      logger.error('Error getting volume analysis:', error)
      throw error
    }
  }

  /**
   * Get detailed volume history for a specific instrument
   */
  async getVolumeHistory(symbol, days = 30) {
    try {
      let query, result
      
      // Check if it's a crypto symbol (contains slash)
      const isCrypto = symbol.includes('/')
      
      if (isCrypto) {
        query = `
          SELECT 
            symbol,
            volume_24h as volume,
            market_timestamp,
            price_usd,
            source
          FROM crypto_prices 
          WHERE symbol = $1 
            AND volume_24h IS NOT NULL 
            AND market_timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
          ORDER BY market_timestamp ASC
        `
      } else {
        query = `
          SELECT 
            symbol,
            volume,
            market_timestamp,
            close,
            source
          FROM daily_prices 
          WHERE symbol = $1 
            AND volume IS NOT NULL 
            AND market_timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
          ORDER BY market_timestamp ASC
        `
      }
      
      result = await this.pool.query(query, [symbol.toUpperCase()])
      
      if (result.rows.length === 0) {
        logger.debug(`No volume history found for ${symbol} in last ${days} days`)
        return []
      }

      return result.rows.map(row => ({
        symbol: row.symbol,
        volume: Number(row.volume),
        timestamp: row.market_timestamp.toISOString(),
        price: Number(row.price_usd || row.close),
        source: row.source
      }))
      
    } catch (error) {
      logger.error(`Error getting volume history for ${symbol}:`, error)
      throw error
    }
  }
}

module.exports = new DatabaseService()