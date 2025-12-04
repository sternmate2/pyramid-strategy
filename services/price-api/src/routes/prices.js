/**
 * Price-related routes
 */

const express = require('express')
const router = express.Router()
const priceController = require('../controllers/priceController')
const validation = require('../middleware/validation')
const auth = require('../middleware/auth')

/**
 * @swagger
 * components:
 *   schemas:
 *     PriceData:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *           example: SPY
 *         open:
 *           type: number
 *           example: 445.20
 *         high:
 *           type: number
 *           example: 448.75
 *         low:
 *           type: number
 *           example: 444.10
 *         close:
 *           type: number
 *           example: 447.50
 *         volume:
 *           type: integer
 *           example: 52847392
 *         timestamp:
 *           type: string
 *           format: date-time
 *         source:
 *           type: string
 *           example: cache
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *         message:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/prices:
 *   get:
 *     summary: Get all available instruments
 *     description: Returns a list of all tracked stock symbols with their latest prices
 *     tags: [Prices]
 *     responses:
 *       200:
 *         description: List of instruments with prices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceData'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/prices', priceController.getAllPrices)

/**
 * @swagger
 * /api/v1/price/{symbol}:
 *   get:
 *     summary: Get latest price for a specific symbol
 *     description: Returns the most recent price data for the specified stock symbol
 *     tags: [Prices]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Stock symbol (e.g., SPY, AAPL)
 *         example: SPY
 *     responses:
 *       200:
 *         description: Latest price data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PriceData'
 *       404:
 *         description: Symbol not found
 *       400:
 *         description: Invalid symbol format
 */
router.get('/price/:symbol', 
  validation.validateSymbol, 
  priceController.getPrice
)

/**
 * @swagger
 * /api/v1/price/{symbol}/history:
 *   get:
 *     summary: Get historical prices for a symbol
 *     description: Returns historical price data for the specified symbol
 *     tags: [Prices]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Stock symbol
 *         example: SPY
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days of historical data
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1d, 1w, 1m]
 *           default: 1d
 *         description: Data interval
 *     responses:
 *       200:
 *         description: Historical price data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     symbol:
 *                       type: string
 *                     period:
 *                       type: string
 *                     prices:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PriceData'
 *       404:
 *         description: Symbol not found or no historical data
 */
router.get('/price/:symbol/history', 
  validation.validateSymbol,
  validation.validateHistoryQuery,
  priceController.getHistoricalPrices
)

/**
 * @swagger
 * /api/v1/prices/bulk:
 *   post:
 *     summary: Get prices for multiple symbols
 *     description: Returns latest price data for multiple symbols in a single request
 *     tags: [Prices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               symbols:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["SPY", "QQQ", "IWM"]
 *                 maxItems: 50
 *     responses:
 *       200:
 *         description: Prices for requested symbols
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/PriceData'
 *       400:
 *         description: Invalid request body
 */
router.post('/prices/bulk',
  validation.validateBulkPricesRequest,
  priceController.getBulkPrices
)

/**
 * @swagger
 * /api/v1/test/mock-data:
 *   get:
 *     summary: Get mock price data for testing
 *     description: Returns mock price data for testing the UI when no real data is available
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Mock price data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceData'
 */
router.get('/test/mock-data', (req, res) => {
  // Generate mock data for testing
  const mockData = [];
  const now = new Date();
  
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    const basePrice = 150 + Math.sin(i * 0.3) * 10;
    
    mockData.push({
      symbol: 'TEST',
      timestamp: timestamp.toISOString(),
      open: basePrice + Math.random() * 2,
      high: basePrice + Math.random() * 3 + 1,
      low: basePrice - Math.random() * 2 - 1,
      close: basePrice + Math.random() * 2,
      volume: Math.floor(Math.random() * 1000000) + 100000,
      source: 'mock'
    });
  }
  
  res.json({
    success: true,
    data: {
      symbol: 'TEST',
      timeframe: '1d',
      interval: '1h',
      prices: mockData
    }
  });
});

/**
 * @swagger
 * /api/v1/stocks/available:
 *   get:
 *     summary: Get available stock symbols
 *     description: Returns a list of all stock symbols available in the database
 *     tags: [Stocks]
 *     responses:
 *       200:
 *         description: List of available stock symbols
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                     example: ["AAPL", "MSFT", "GOOGL"]
 */
router.get('/stocks/available', priceController.getAvailableStocks);

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Simple health check to verify API is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "API is running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/v1/test/simple:
 *   get:
 *     summary: Simple test endpoint
 *     description: Basic test endpoint that doesn't require database
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Test endpoint working"
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     random:
 *                       type: number
 *                       example: 0.123456789
 */
router.get('/test/simple', (req, res) => {
  res.json({
    success: true,
    message: 'Test endpoint working',
    data: {
      timestamp: new Date().toISOString(),
      random: Math.random()
    }
  });
});

/**
 * @swagger
 * /api/v1/test/populate-sample-data:
 *   get:
 *     summary: Populate database with sample price data
 *     description: Creates sample price data for testing purposes
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Sample data created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Sample data created"
 *                 data:
 *                   type: object
 *                   properties:
 *                     symbols:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN", "IWM", "SPY", "QQQ"]
 *                     records:
 *                       type: number
 *                       example: 240
 */
router.get('/test/populate-sample-data', priceController.populateSampleData)

/**
 * @swagger
 * /api/v1/test/database-schema:
 *   get:
 *     summary: Test database schema and constraints
 *     description: Checks database table structure and tests basic operations
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Schema test completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.get('/test/database-schema', priceController.testDatabaseSchema);

/**
 * @swagger
 * /api/v1/test/delete-sample-data:
 *   delete:
 *     summary: Delete all sample data from database
 *     description: Removes all sample data (instruments and prices) that were inserted for testing
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Sample data deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted_instruments:
 *                       type: integer
 *                       description: Number of instruments deleted
 *                     deleted_prices:
 *                       type: integer
 *                       description: Number of price records deleted
 */
router.delete('/test/delete-sample-data', priceController.deleteSampleData);

/**
 * @swagger
 * /api/v1/crypto/:symbol:
 *   get:
 *     summary: Get cryptocurrency price data
 *     description: Fetch current and historical cryptocurrency prices
 *     tags: [Cryptocurrency]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol (e.g., BTC, ETH)
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days of historical data
 *     responses:
 *       200:
 *         description: Cryptocurrency price data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     symbol:
 *                       type: string
 *                     prices:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                           price_usd:
 *                             type: number
 *                           volume_24h:
 *                             type: number
 *                           market_cap_usd:
 *                             type: number
 */
router.get('/crypto/:symbol', priceController.getCryptoPrice);

/**
 * @swagger
 * /api/v1/instruments:
 *   get:
 *     summary: Get all available instruments
 *     description: Returns metadata for all tracked instruments/symbols
 *     tags: [Instruments]
 *     responses:
 *       200:
 *         description: List of instruments
 */
router.get('/instruments', priceController.getInstruments)

/**
 * @swagger
 * /api/v1/instrument/{symbol}:
 *   get:
 *     summary: Get instrument details
 *     description: Returns detailed information about a specific instrument
 *     tags: [Instruments]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Stock symbol
 */
router.get('/instrument/:symbol',
  validation.validateSymbol,
  priceController.getInstrument
)

/**
 * @swagger
 * /api/v1/price/{symbol}/current:
 *   get:
 *     summary: Get current price for a symbol
 *     description: Returns the most recent price data for the specified stock symbol
 *     tags: [Prices]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Stock symbol (e.g., SPY, AAPL)
 *         example: SPY
 *     responses:
 *       200:
 *         description: Current price data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PriceData'
 *       404:
 *         description: Symbol not found
 *       400:
 *         description: Invalid symbol format
 */
router.get('/price/:symbol/current', 
  validation.validateSymbol, 
  priceController.getCurrentPrice
)

/**
 * @swagger
 * /api/v1/prices/{symbol}:
 *   get:
 *     summary: Get prices for a symbol with timeframe and interval
 *     description: Returns price data for the specified symbol with customizable timeframe and interval
 *     tags: [Prices]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Stock symbol (e.g., SPY, AAPL)
 *         example: SPY
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1d, 5d, 1m, 3m, 6m, 1y]
 *           default: 1d
 *         description: Timeframe for data
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 1d]
 *           default: 1d
 *         description: Data interval
 *     responses:
 *       200:
 *         description: Price data for the specified timeframe and interval
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceData'
 *       404:
 *         description: Symbol not found or no data available
 *       400:
 *         description: Invalid parameters
 */
// Special route for crypto symbols with slashes (e.g., BTC/USD) - MUST come BEFORE /prices/:symbol
router.get('/prices/:base/:quote', 
  priceController.getCryptoPricesWithTimeframe
)

router.get('/prices/:symbol', 
  validation.validateSymbol, 
  priceController.getPricesWithTimeframe
)

/**
 * @swagger
 * /api/v1/stocks/{symbol}/prices:
 *   get:
 *     summary: Get stock prices with timeframe and interval (alternative endpoint)
 *     description: Alternative endpoint for getting stock prices with customizable parameters
 *     tags: [Prices]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Stock symbol
 *         example: SPY
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1d, 5d, 1m, 3m, 6m, 1y]
 *           default: 1d
 *         description: Timeframe for data
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 1d]
 *           default: 1d
 *         description: Data interval
 *     responses:
 *       200:
 *         description: Stock price data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceData'
 */
router.get('/stocks/:symbol/prices', 
  validation.validateSymbol, 
  priceController.getPricesWithTimeframe
)

/**
 * @swagger
 * /api/v1/market/{symbol}:
 *   get:
 *     summary: Get market data for a symbol (alternative endpoint)
 *     description: Alternative endpoint for getting market data with customizable parameters
 *     tags: [Prices]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Stock symbol
 *         example: SPY
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1d, 5d, 1m, 3m, 6m, 1y]
 *           default: 1d
 *         description: Timeframe for data
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 1d]
 *           default: 1d
 *         description: Data interval
 *     responses:
 *       200:
 *         description: Market data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceData'
 */
router.get('/market/:symbol', 
  validation.validateSymbol, 
  priceController.getPricesWithTimeframe
)

/**
 * @swagger
 * /api/v1/volume/analysis:
 *   get:
 *     summary: Get volume analysis for all instruments
 *     description: Returns volume statistics (current, average, trend) for all tracked instruments
 *     tags: [Volume]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days for volume analysis
 *     responses:
 *       200:
 *         description: Volume analysis data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     analysis_date:
 *                       type: string
 *                       format: date-time
 *                     period_days:
 *                       type: integer
 *                     total_instruments:
 *                       type: integer
 *                     instruments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           symbol:
 *                             type: string
 *                           instrument_type:
 *                             type: string
 *                             enum: [stock, crypto]
 *                           current_volume:
 *                             type: integer
 *                           average_volume:
 *                             type: integer
 *                           max_volume:
 *                             type: integer
 *                           min_volume:
 *                             type: integer
 *                           volume_trend_percent:
 *                             type: number
 *                           data_points:
 *                             type: integer
 *                           latest_timestamp:
 *                             type: string
 *                             format: date-time
 *                           source:
 *                             type: string
 */
router.get('/volume/analysis', priceController.getVolumeAnalysis)

/**
 * @swagger
 * /api/v1/volume/{symbol}/history:
 *   get:
 *     summary: Get volume history for a specific instrument
 *     description: Returns detailed volume history for the specified instrument
 *     tags: [Volume]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Instrument symbol (e.g., SPY, BTC/USD)
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days for volume history
 *     responses:
 *       200:
 *         description: Volume history data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     symbol:
 *                       type: string
 *                     period_days:
 *                       type: integer
 *                     data_points:
 *                       type: integer
 *                     volume_history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           symbol:
 *                             type: string
 *                           volume:
 *                             type: integer
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           price:
 *                             type: number
 *                           source:
 *                             type: string
 *       404:
 *         description: No volume data found for symbol
 */
router.get('/volume/:symbol/history', priceController.getVolumeHistory)

module.exports = router