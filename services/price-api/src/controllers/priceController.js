/**
 * Price data controller
 */

const { StatusCodes } = require('http-status-codes')
const priceService = require('../services/priceService')
const logger = require('../utils/logger')
const { ApiResponse } = require('../constants/apiResponses')

class PriceController {
  /**
   * Get all available prices
   */
  async getAllPrices(req, res, next) {
    try {
      logger.debug('Getting all prices')
      
      const prices = await priceService.getAllLatestPrices()
      
      res.json(ApiResponse.success({
        count: prices.length,
        prices: prices
      }))
    } catch (error) {
      logger.error('Error getting all prices:', error)
      next(error)
    }
  }

  /**
   * Get price for a specific symbol
   */
  async getPrice(req, res, next) {
    try {
      const { symbol } = req.params
      logger.debug(`Getting price for ${symbol}`)

      const price = await priceService.getLatestPrice(symbol)
      
      if (!price) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('Price not found', `No price data available for symbol ${symbol}`))
      }

      res.json(ApiResponse.success(price))
    } catch (error) {
      logger.error(`Error getting price for ${req.params.symbol}:`, error)
      next(error)
    }
  }

  /**
   * Get historical prices for a symbol
   */
  async getHistoricalPrices(req, res, next) {
    try {
      const { symbol } = req.params
      const { days = 30, interval = '1d' } = req.query
      
      logger.debug(`Getting historical prices for ${symbol}, days: ${days}, interval: ${interval}`)

      const historicalData = await priceService.getHistoricalPrices(symbol, parseInt(days), interval)
      
      if (!historicalData || historicalData.prices.length === 0) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('Historical data not found', `No historical data available for symbol ${symbol}`))
      }

      res.json(ApiResponse.success(historicalData))
    } catch (error) {
      logger.error(`Error getting historical prices for ${req.params.symbol}:`, error)
      next(error)
    }
  }

  /**
   * Get prices for multiple symbols
   */
  async getBulkPrices(req, res, next) {
    try {
      const { symbols } = req.body
      logger.debug(`Getting bulk prices for ${symbols.length} symbols`)

      const prices = await priceService.getBulkPrices(symbols)
      
      res.json(ApiResponse.success({
        requested: symbols,
        count: Object.keys(prices).length,
        prices: prices
      }))
    } catch (error) {
      logger.error('Error getting bulk prices:', error)
      next(error)
    }
  }

  /**
   * Get all available instruments
   */
  async getInstruments(req, res, next) {
    try {
      logger.debug('Getting all instruments')
      
      const instruments = await priceService.getAllInstruments()
      
      res.json(ApiResponse.success({
        count: instruments.length,
        instruments: instruments
      }))
    } catch (error) {
      logger.error('Error getting instruments:', error)
      next(error)
    }
  }

  /**
   * Get details for a specific instrument
   */
  async getInstrument(req, res, next) {
    try {
      const { symbol } = req.params
      logger.debug(`Getting instrument details for ${symbol}`)

      const instrument = await priceService.getInstrument(symbol)
      
      if (!instrument) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('Instrument not found', `No instrument data available for symbol ${symbol}`))
      }

      res.json(ApiResponse.success(instrument))
    } catch (error) {
      logger.error(`Error getting instrument ${req.params.symbol}:`, error)
      next(error)
    }
  }

  /**
   * Get current price for a symbol (alias for getPrice)
   */
  async getCurrentPrice(req, res, next) {
    try {
      const { symbol } = req.params
      logger.debug(`Getting current price for ${symbol}`)

      const price = await priceService.getLatestPrice(symbol)
      
      if (!price) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('Current price not found', `No current price data available for symbol ${symbol}`))
      }

      res.json(ApiResponse.success(price))
    } catch (error) {
      logger.error(`Error getting current price for ${req.params.symbol}:`, error)
      next(error)
    }
  }

  /**
   * Get prices for a symbol with timeframe and interval parameters
   */
  async getPricesWithTimeframe(req, res, next) {
    try {
      const { symbol } = req.params
      const { timeframe = '1d', interval = '1d' } = req.query
      
      logger.debug(`Getting prices for ${symbol}, timeframe: ${timeframe}, interval: ${interval}`)

      // Convert timeframe to days for the service
      let days = 30 // default
      switch (timeframe) {
        case '1d': days = 1; break
        case '5d': days = 5; break
        case '1m': days = 30; break
        case '3m': days = 90; break
        case '6m': days = 180; break
        case '1y': days = 365; break
        default: days = 30
      }

      // Convert interval to service format
      let serviceInterval = '1d' // default
      switch (interval) {
        case '1m': serviceInterval = '1m'; break
        case '5m': serviceInterval = '5m'; break
        case '15m': serviceInterval = '15m'; break
        case '1h': serviceInterval = '1h'; break
        case '1d': serviceInterval = '1d'; break
        default: serviceInterval = '1d'
      }

      const historicalData = await priceService.getHistoricalPrices(symbol, days, serviceInterval)
      
      if (!historicalData || historicalData.prices.length === 0) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('Price data not found', `No price data available for symbol ${symbol} with timeframe ${timeframe} and interval ${interval}`))
      }

      res.json(ApiResponse.success({
        symbol: symbol,
        timeframe: timeframe,
        interval: interval,
        prices: historicalData.prices
      }))
    } catch (error) {
      logger.error(`Error getting prices for ${req.params.symbol} with timeframe:`, error)
      next(error)
    }
  }

  /**
   * Get prices for crypto symbols with slashes (e.g., BTC/USD)
   */
  async getCryptoPricesWithTimeframe(req, res, next) {
    try {
      const { base, quote } = req.params
      const { timeframe = '1d', interval = '1d' } = req.query
      const symbol = `${base}/${quote}`
      
      logger.debug(`Getting crypto prices for ${symbol}, timeframe: ${timeframe}, interval: ${interval}`)

      // Convert timeframe to days for the service
      let days = 30 // default
      switch (timeframe) {
        case '1d': days = 1; break
        case '5d': days = 5; break
        case '1m': days = 30; break
        case '3m': days = 90; break
        case '6m': days = 180; break
        case '1y': days = 365; break
        default: days = 30
      }

      // Convert interval to service format
      let serviceInterval = '1d' // default
      switch (interval) {
        case '1m': serviceInterval = '1m'; break
        case '5m': serviceInterval = '5m'; break
        case '15m': serviceInterval = '15m'; break
        case '1h': serviceInterval = '1h'; break
        case '1d': serviceInterval = '1d'; break
        default: serviceInterval = '1d'
      }

      const historicalData = await priceService.getHistoricalPrices(symbol, days, serviceInterval)
      
      if (!historicalData || historicalData.prices.length === 0) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('Price data not found', `No price data available for crypto symbol ${symbol} with timeframe ${timeframe} and interval ${interval}`))
      }

      // For crypto symbols, if we have limited data, adjust the response to show what we have
      if (historicalData.prices.length < 10) {
        logger.info(`Limited data available for ${symbol}: ${historicalData.prices.length} records. Returning available data.`)
      }

      res.json(ApiResponse.success({
        symbol: symbol,
        timeframe: timeframe,
        interval: interval,
        prices: historicalData.prices
      }))
    } catch (error) {
      logger.error(`Error getting crypto prices for ${req.params.base}/${req.params.quote} with timeframe:`, error)
      next(error)
    }
  }

  /**
   * Get available stock symbols from database
   */
  async getAvailableStocks(req, res, next) {
    try {
      const stocks = await priceService.getAvailableStocks()
      
      if (!stocks || stocks.length === 0) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('No stocks found', 'No stock symbols available in the database'))
      }

      res.json(ApiResponse.success(stocks))
    } catch (error) {
      logger.error('Error getting available stocks:', error)
      next(error)
    }
  }

  /**
   * Populate database with sample price data for testing
   */
  async populateSampleData(req, res, next) {
    try {
      const result = await priceService.populateSampleData()
      
      res.json(ApiResponse.success({
        message: 'Sample data created successfully',
        data: result
      }))
    } catch (error) {
      logger.error('Error populating sample data:', error)
      next(error)
    }
  }
  
  async testDatabaseSchema(req, res, next) {
    try {
      const result = await priceService.testDatabaseSchema()
      res.json(ApiResponse.success(result))
    } catch (error) {
      logger.error('Error testing database schema:', error)
      next(error)
    }
  }

  /**
   * Delete all sample data from database
   */
  async deleteSampleData(req, res, next) {
    try {
      const result = await priceService.deleteSampleData()
      
      res.json(ApiResponse.success({
        message: 'Sample data deleted successfully',
        data: {
          ...result,
          cache_cleaned: result.cleared_cache_entries > 0
        }
      }))
    } catch (error) {
      logger.error('Error deleting sample data:', error)
      next(error)
    }
  }

  /**
   * Get cryptocurrency price data
   */
  async getCryptoPrice(req, res, next) {
    try {
      const { symbol } = req.params
      const { days = 30 } = req.query
      
      logger.debug(`Getting cryptocurrency price for ${symbol}, days: ${days}`)

      const cryptoData = await priceService.getCryptoPrice(symbol, parseInt(days))
      
      if (!cryptoData || cryptoData.prices.length === 0) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('Cryptocurrency data not found', `No data available for ${symbol}`))
      }

      res.json(ApiResponse.success(cryptoData))
    } catch (error) {
      logger.error(`Error getting cryptocurrency price for ${req.params.symbol}:`, error)
      next(error)
    }
  }

  /**
   * Get volume analysis for all instruments
   */
  async getVolumeAnalysis(req, res, next) {
    try {
      const { days = 30 } = req.query
      const daysInt = parseInt(days)
      
      if (isNaN(daysInt) || daysInt < 1 || daysInt > 365) {
        return res.status(StatusCodes.BAD_REQUEST)
          .json(ApiResponse.error('Invalid days parameter', 'Days must be between 1 and 365'))
      }

      logger.debug(`Getting volume analysis for ${daysInt} days`)

      const volumeData = await priceService.getVolumeAnalysis(daysInt)
      
      res.json(ApiResponse.success({
        analysis_date: new Date().toISOString(),
        period_days: daysInt,
        total_instruments: volumeData.length,
        instruments: volumeData
      }))
    } catch (error) {
      logger.error('Error getting volume analysis:', error)
      next(error)
    }
  }

  /**
   * Get volume history for a specific instrument
   */
  async getVolumeHistory(req, res, next) {
    try {
      const { symbol } = req.params
      const { days = 30 } = req.query
      const daysInt = parseInt(days)
      
      if (isNaN(daysInt) || daysInt < 1 || daysInt > 365) {
        return res.status(StatusCodes.BAD_REQUEST)
          .json(ApiResponse.error('Invalid days parameter', 'Days must be between 1 and 365'))
      }

      if (!symbol) {
        return res.status(StatusCodes.BAD_REQUEST)
          .json(ApiResponse.error('Missing symbol', 'Symbol parameter is required'))
      }

      logger.debug(`Getting volume history for ${symbol} over ${daysInt} days`)

      const volumeHistory = await priceService.getVolumeHistory(symbol, daysInt)
      
      if (!volumeHistory.volume_history || volumeHistory.volume_history.length === 0) {
        return res.status(StatusCodes.NOT_FOUND)
          .json(ApiResponse.error('Volume data not found', `No volume data available for ${symbol}`))
      }

      res.json(ApiResponse.success(volumeHistory))
    } catch (error) {
      logger.error(`Error getting volume history for ${req.params.symbol}:`, error)
      next(error)
    }
  }
}

module.exports = new PriceController()