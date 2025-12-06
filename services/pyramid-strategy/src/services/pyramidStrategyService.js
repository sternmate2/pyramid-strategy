const { query } = require('../utils/database')
const LevelService = require('./levelService')
const PositionService = require('./positionService')
const logger = require('../utils/logger')
const config = require('../config')
const telegramNotifier = require('../utils/telegramNotifier')

class PyramidStrategyService {
    constructor() {
        this.levelService = new LevelService()
        this.positionService = new PositionService()
        this.lastPrices = {} // Track last prices per symbol
        this.initialized = false
        this.monitoringInterval = null // For active price monitoring
        this.isMarketHours = false
    }

    /**
     * Initialize the service by setting the highest price from database
     */
    async initialize() {
        try {
            if (this.initialized) return

            // Get the highest price from both daily and intraday tables for SPXL
            const queryText = `
                WITH daily_highs AS (
                    SELECT MAX(high) as highest_price, 'daily_prices' as source
                    FROM daily_prices 
                    WHERE symbol = 'SPXL'
                ),
                intraday_highs AS (
                    SELECT MAX(price) as highest_price, 'intraday_prices' as source
                    FROM intraday_prices 
                    WHERE symbol = 'SPXL'
                )
                SELECT 
                    GREATEST(
                        COALESCE((SELECT highest_price FROM daily_highs), 0),
                        COALESCE((SELECT highest_price FROM intraday_highs), 0)
                    ) as highest_price,
                    CASE 
                        WHEN COALESCE((SELECT highest_price FROM intraday_highs), 0) > COALESCE((SELECT highest_price FROM daily_highs), 0) 
                        THEN 'intraday_prices'
                        ELSE 'daily_prices'
                    END as source,
                    (SELECT highest_price FROM daily_highs) as daily_high,
                    (SELECT highest_price FROM intraday_highs) as intraday_high
            `
            const result = await query(queryText, [])

            if (result.rows.length > 0 && result.rows[0].highest_price) {
                const row = result.rows[0]
                const highestPrice = Number(row.highest_price)
                const source = row.source
                const dailyHigh = row.daily_high ? Number(row.daily_high) : null
                const intradayHigh = row.intraday_high ? Number(row.intraday_high) : null

                this.levelService.updateHighestPrice(highestPrice)

                logger.info('Service initialized with highest price', {
                    highestPrice,
                    source,
                    dailyHigh,
                    intradayHigh
                })

                console.log(`🏆 Highest price: $${highestPrice.toFixed(2)} (from ${source})`)
                if (dailyHigh) console.log(`📊 Daily high: $${dailyHigh.toFixed(2)}`)
                if (intradayHigh) console.log(`⏰ Intraday high: $${intradayHigh.toFixed(2)}`)
            } else {
                logger.warning('No price data found for SPXL, using default highest price')
                this.levelService.updateHighestPrice(199.00) // Fallback
            }

            // Rebuild level states from existing positions to prevent duplicate buys
            await this.rebuildLevelStatesFromPositions('SPXL')

            // Start active price monitoring after initialization
            this.startActiveMonitoring()

            this.initialized = true
        } catch (error) {
            logger.error('Error initializing service', { error: error.message })
            // Use fallback price
            this.levelService.updateHighestPrice(199.00)

            // Still rebuild level states even on error to prevent duplicate buys
            try {
                await this.rebuildLevelStatesFromPositions('SPXL')
            } catch (rebuildError) {
                logger.error('Error rebuilding level states during error recovery', { error: rebuildError.message })
            }

            this.initialized = true
        }
    }

    /**
     * Start active price monitoring - queries database every 15 minutes during market hours
     * Runs 1 minute after price ingestion completes to ensure fresh data
     */
    startActiveMonitoring() {
        logger.info('🔄 Starting active price monitoring...')

        // Check market hours immediately
        this.checkMarketHours()

        // Set up interval to check every 15 minutes (900,000 ms)
        // This aligns with price ingestion schedule (every 15 min) + 1 minute offset
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.activeMonitoringTick()
            } catch (error) {
                logger.error('Error in active monitoring tick', { error: error.message })
            }
        }, 15 * 60 * 1000) // 15 minutes

        // Schedule first run with 1-minute offset from price ingestion
        setTimeout(async () => {
            try {
                logger.info('🎯 Running initial monitoring tick (1 min after service start)')
                await this.activeMonitoringTick()
            } catch (error) {
                logger.error('Error in initial monitoring tick', { error: error.message })
            }
        }, 1 * 60 * 1000) // 1 minute delay

        logger.info('✅ Active price monitoring started - checking every 15 minutes (1 min after price ingestion)')
    }

    /**
     * Stop active price monitoring
     */
    stopActiveMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval)
            this.monitoringInterval = null
            logger.info('🛑 Active price monitoring stopped')
        }
    }

    /**
     * Check if current time is during market hours (9:30 AM - 4:00 PM ET / 14:30 - 21:00 UTC)
     */
    checkMarketHours() {
        const now = new Date()
        const utcHour = now.getUTCHours()
        const utcMinute = now.getUTCMinutes()
        const dayOfWeek = now.getUTCDay() // 0 = Sunday, 6 = Saturday

        // Market is closed on weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            this.isMarketHours = false
            return false
        }

        // Convert time to minutes since midnight UTC
        const currentTimeMinutes = utcHour * 60 + utcMinute
        const marketOpenMinutes = 14 * 60 + 30 // 14:30 UTC (9:30 AM ET)
        const marketCloseMinutes = 21 * 60 + 0  // 21:00 UTC (4:00 PM ET)

        this.isMarketHours = currentTimeMinutes >= marketOpenMinutes && currentTimeMinutes <= marketCloseMinutes

        return this.isMarketHours
    }

    /**
     * Active monitoring tick - runs every 15 minutes, 1 minute after price ingestion
     */
    async activeMonitoringTick() {
        const wasMarketHours = this.isMarketHours
        const isCurrentlyMarketHours = this.checkMarketHours()

        // Log market hours status change
        if (wasMarketHours !== isCurrentlyMarketHours) {
            if (isCurrentlyMarketHours) {
                logger.info('📈 Market opened - active monitoring enabled')
            } else {
                logger.info('📉 Market closed - active monitoring paused')
            }
        }

        if (!isCurrentlyMarketHours) {
            logger.debug('⏸️  Market closed - skipping active monitoring tick')
            return
        }

        logger.info('🔍 Active monitoring tick - checking intraday prices (1 min after price ingestion)...')

        try {
            // Get latest price from intraday table
            const latestPrice = await this.getLatestIntradayPrice('SPXL')

            if (latestPrice) {
                logger.info(`📊 Latest intraday price: $${latestPrice.price} (${latestPrice.timestamp})`)

                // Process this price update through the normal strategy logic
                await this.processPriceUpdate('SPXL', latestPrice.price)
            } else {
                logger.warning('⚠️  No recent intraday price data found')
            }

        } catch (error) {
            logger.error('Error in active monitoring tick', { error: error.message })
        }
    }

    /**
     * Get latest price from intraday_prices table
     * @param {string} symbol - Stock symbol
     * @returns {Object|null} - Latest price data or null
     */
    async getLatestIntradayPrice(symbol = 'SPXL') {
        try {
            const queryText = `
                SELECT price, timestamp
                FROM intraday_prices 
                WHERE symbol = $1 
                ORDER BY timestamp DESC 
                LIMIT 1
            `
            const result = await query(queryText, [symbol])

            if (result.rows.length > 0) {
                const row = result.rows[0]
                return {
                    price: Number(row.price),
                    timestamp: row.timestamp
                }
            }

            return null

        } catch (error) {
            logger.error('Error getting latest intraday price', {
                symbol,
                error: error.message
            })
            return null
        }
    }

    /**
     * Get the highest price from both daily and intraday tables
     * @param {string} symbol - Stock symbol (default: 'SPXL')
     * @returns {Object} - Object containing highest price and source information
     */
    async getHighestPriceFromBothTables(symbol = 'SPXL') {
        try {
            const queryText = `
                WITH daily_highs AS (
                    SELECT MAX(high) as highest_price
                    FROM daily_prices 
                    WHERE symbol = $1
                ),
                intraday_highs AS (
                    SELECT MAX(price) as highest_price
                    FROM intraday_prices 
                    WHERE symbol = $1
                )
                SELECT 
                    GREATEST(
                        COALESCE((SELECT highest_price FROM daily_highs), 0),
                        COALESCE((SELECT highest_price FROM intraday_highs), 0)
                    ) as highest_price,
                    CASE 
                        WHEN COALESCE((SELECT highest_price FROM intraday_highs), 0) > COALESCE((SELECT highest_price FROM daily_highs), 0) 
                        THEN 'intraday_prices'
                        ELSE 'daily_prices'
                    END as source,
                    (SELECT highest_price FROM daily_highs) as daily_high,
                    (SELECT highest_price FROM intraday_highs) as intraday_high
            `

            const result = await query(queryText, [symbol])

            if (result.rows.length > 0 && result.rows[0].highest_price) {
                const row = result.rows[0]
                return {
                    highestPrice: Number(row.highest_price),
                    source: row.source,
                    dailyHigh: row.daily_high ? Number(row.daily_high) : null,
                    intradayHigh: row.intraday_high ? Number(row.intraday_high) : null
                }
            }

            return {
                highestPrice: 199.00, // Fallback
                source: 'fallback',
                dailyHigh: null,
                intradayHigh: null
            }
        } catch (error) {
            logger.error('Error getting highest price from both tables', {
                symbol,
                error: error.message
            })
            return {
                highestPrice: 199.00, // Fallback
                source: 'fallback',
                dailyHigh: null,
                intradayHigh: null
            }
        }
    }

    /**
     * Process price update and execute strategy
     * @param {string} symbol - Stock symbol
     * @param {number} price - Current price
     */
    async processPriceUpdate(symbol, price) {
        try {
            // Ensure service is initialized
            if (!this.initialized) {
                await this.initialize()
            }

            // Check for higher price trigger first (before updating highest price)
            await this.checkHigherPriceTrigger(symbol, price)

            // Get last price for this symbol
            const lastPrice = this.lastPrices[symbol]

            // 🔥 CHECK SELL TRIGGERS FIRST (using current levels before recalculation)
            await this.checkSellTriggers(symbol, price)

            // Update highest price and levels only if price increases AND not in test mode
            // This is done AFTER sell triggers to ensure positions sell at intended levels
            if (price > this.levelService.highestPrice && !this.levelService.testMode) {
                this.levelService.updateHighestPrice(price)
            }

            // Check for buy triggers (only on price drops)
            if (!lastPrice || price < lastPrice) {
                await this.checkBuyTriggers(symbol, price)
            }

            // Update last price after processing
            this.lastPrices[symbol] = price

        } catch (error) {
            logger.error('Error processing price update', {
                symbol,
                price,
                error: error.message
            })
        }
    }

    /**
     * Check for higher price trigger (new all-time high)
     * @param {string} symbol - Stock symbol
     * @param {number} price - Current price
     */
    async checkHigherPriceTrigger(symbol, price) {
        try {
            // Only trigger if price is higher than current highest price
            if (price > this.levelService.highestPrice) {
                const previousHighest = this.levelService.highestPrice
                const priceIncrease = price - previousHighest
                const percentageIncrease = ((price - previousHighest) / previousHighest) * 100

                // Create higher price notification
                const notification = {
                    type: 'higher_price',
                    symbol: symbol.toUpperCase(),
                    price: price,
                    previousHighest: previousHighest,
                    priceIncrease: priceIncrease,
                    percentageIncrease: percentageIncrease,
                    message: `🚀 ${symbol.toUpperCase()} NEW HIGH! Price reached $${price.toFixed(2)} (up $${priceIncrease.toFixed(2)} from previous high of $${previousHighest.toFixed(2)} - ${percentageIncrease.toFixed(2)}% increase)`,
                    timestamp: new Date().toISOString()
                }

                // Log the notification
                logger.logNotification('higher_price', symbol, {
                    price: price,
                    previousHighest: previousHighest,
                    priceIncrease: priceIncrease,
                    percentageIncrease: percentageIncrease
                })

                console.log(`🚀 HIGHER PRICE NOTIFICATION: ${symbol} reached new high of $${price.toFixed(2)}`)
                console.log(`📈 Previous high: $${previousHighest.toFixed(2)} | Increase: $${priceIncrease.toFixed(2)} (${percentageIncrease.toFixed(2)}%)`)

                // Send Telegram notification (fire-and-forget to avoid blocking)
                telegramNotifier.notifyHigherPrice({
                    symbol: symbol.toUpperCase(),
                    price,
                    previousHighest,
                    percentageIncrease
                }).catch(e => logger.error('Telegram higher price notification failed', { error: e.message }))

                // Send webhook notification to n8n (optional - can be removed)
                await this.sendHigherPriceWebhook(notification)

            }
        } catch (error) {
            logger.error('Error checking higher price trigger', {
                symbol,
                price,
                error: error.message
            })
        }
    }

    /**
     * Check for buy triggers (including rebuy logic)
     * @param {string} symbol - Stock symbol
     * @param {number} price - Current price
     */
    async checkBuyTriggers(symbol, price) {
        const lastPrice = this.lastPrices[symbol]
        const triggeredLevels = this.levelService.getAllTriggeredLevels(price, lastPrice)

        // Process all triggered levels
        for (const buyLevel of triggeredLevels) {
            const levelBuyCount = this.levelService.getBuyCountForLevel(buyLevel.level, 'below')
            const dollarAmount = this.positionService.calculateBuyDollarAmountForLevel(buyLevel.level, levelBuyCount)
            const units = Math.floor(dollarAmount / price)
            const actualValue = units * price

            // Check if we already have a position at this level (for rebuy)
            const existingPosition = await this.positionService.getPositionForLevel(symbol, buyLevel.level)

            // Check if this position should be an anchor
            const isAnchor = this.levelService.isAnchorLevel(buyLevel.level)

            let position;
            if (existingPosition && buyLevel.isRebuy) {
                // REBUY: Add to existing position
                position = await this.positionService.addToExistingPosition(existingPosition.id, units, actualValue)
                console.log(`🔧 REBUY: Added ${units} units to existing Level ${buyLevel.level} position (total: ${position.units} units)`)
            } else {
                // NEW BUY: Create new position  
                position = await this.positionService.createBuyPosition(
                    symbol,
                    price,
                    buyLevel.level,
                    levelBuyCount,
                    isAnchor
                )

                // Double-check if this position should be an anchor and update if needed
                const shouldBeAnchor = this.levelService.isAnchorLevel(buyLevel.level)
                if (shouldBeAnchor && !position.is_anchor) {
                    console.log(`🔧 Updating position ${position.id} to be anchor`)
                    await this.positionService.updatePositionAnchorFlag(position.id, true)
                }
            }

            // Mark level as bought
            this.levelService.markLevelAsBought(buyLevel.level, 'below')

            // Get sell trigger price (null for anchor level)
            const sellTriggerPrice = this.levelService.isAnchorLevel(buyLevel.level) ? null : this.levelService.getSellTriggerPrice(buyLevel.level)

            const actionType = buyLevel.isRebuy ? 'REBUY' : 'BUY'
            const buyNumber = levelBuyCount + 1

            logger.logNotification('buy', symbol, {
                level: buyLevel.level,
                price,
                units,
                dollarAmount,
                actualValue,
                sellTriggerPrice,
                buyCount: buyNumber,
                isRebuy: buyLevel.isRebuy
            })

            const anchorText = isAnchor ? ' (ANCHOR - NEVER SOLD)' : ''

            console.log(`🔔 ${actionType} NOTIFICATION: Level ${buyLevel.level} triggered at $${price.toFixed(2)}${anchorText}`)
            console.log(`💰 ${actionType === 'REBUY' ? 'Rebuying' : 'Buying'} ${units} units (~$${dollarAmount}) at $${price.toFixed(2)} (${actionType.toLowerCase()} #${buyNumber})`)
            console.log(`📊 Actual value: $${actualValue.toFixed(2)}`)

            if (isAnchor) {
                console.log(`⚓ ANCHOR POSITION: This position will never be sold`)
            } else if (sellTriggerPrice) {
                console.log(`🎯 Sell trigger: $${sellTriggerPrice.toFixed(2)} (14¢ below Level ${buyLevel.level} above)`)
            }

            // Send Telegram notification (fire-and-forget to avoid blocking)
            telegramNotifier.notifyBuy({
                symbol,
                level: buyLevel.level,
                price,
                units,
                dollarAmount,
                sellTriggerPrice,
                isRebuy: buyLevel.isRebuy,
                isAnchor
            }).catch(e => logger.error('Telegram buy notification failed', { error: e.message }))
        }

        // Set anchor level to the deepest level that was triggered (highest level number)
        if (triggeredLevels.length > 0) {
            const deepestLevel = Math.max(...triggeredLevels.map(level => level.level))

            // Update anchor if this is the first anchor or if we found a deeper level
            if (this.levelService.anchorLevel === null || deepestLevel > this.levelService.anchorLevel) {
                const previousAnchor = this.levelService.anchorLevel
                console.log(`🔧 Anchor level ${previousAnchor ? `moving from ${previousAnchor} to ${deepestLevel}` : `set to ${deepestLevel}`} (deepest triggered level)`)
                this.levelService.setAnchorLevel(deepestLevel)

                // Update all positions to reflect the correct anchor status
                const activePositions = await this.positionService.getActiveBuyPositions(symbol)
                for (const position of activePositions) {
                    const shouldBeAnchor = position.threshold_level === deepestLevel
                    if (shouldBeAnchor !== position.is_anchor) {
                        console.log(`🔧 Updating position ${position.id} anchor status: ${shouldBeAnchor}`)
                        await this.positionService.updatePositionAnchorFlag(position.id, shouldBeAnchor)
                    }
                }
            } else {
                console.log(`🔧 Anchor level stays at ${this.levelService.anchorLevel} (deeper than new levels)`)
            }
        }
    }

    /**
     * Sell a specific level at a given price
     * @param {string} symbol - Stock symbol
     * @param {number} sellPrice - Price to sell at
     * @param {number} level - Level to sell
     */
    async sellLevelAtPrice(symbol, sellPrice, level) {
        try {
            // Get active positions for this level
            const positions = await this.positionService.getActiveBuyPositions(symbol)
            const levelPositions = positions.filter(p => p.threshold_level === level)

            for (const position of levelPositions) {
                // Close the position
                await this.positionService.closePosition(position.id, sellPrice, level)

                // Mark level as sold (for rebuy logic)
                this.levelService.markLevelAsSold(position.threshold_level, 'below')

                logger.logNotification('sell', symbol, {
                    positionId: position.id,
                    level: position.threshold_level,
                    buyPrice: position.price,
                    sellPrice: sellPrice,
                    units: position.units,
                    dollarAmount: position.dollar_amount,
                    sellTriggerPrice: sellPrice
                })

                console.log(`🔔 SELL NOTIFICATION: Level ${level} sold at $${sellPrice} (new anchor set)`)
                console.log(`💰 Selling ${position.units} units (~$${position.dollar_amount}) at $${sellPrice}`)
            }
        } catch (error) {
            logger.error('Error selling level at price', { symbol, sellPrice, level, error })
        }
    }

    /**
     * Check for sell triggers
     * @param {string} symbol - Stock symbol
     * @param {number} price - Current price
     */
    async checkSellTriggers(symbol, price) {
        const positionsToSell = await this.positionService.checkSellTriggers(
            symbol,
            price,
            this.levelService
        )

        for (const { position, sellTriggerPrice, sellLevel } of positionsToSell) {
            // Skip anchor positions - they should never be sold
            // Check if this position was originally an anchor position
            const isOriginalAnchor = position.is_anchor || false
            if (isOriginalAnchor) {
                console.log(`⚓ ANCHOR PROTECTION: Skipping sell for Level ${position.threshold_level} (original anchor position)`)
                continue
            }

            // Close the position using dollar amount based selling
            const sellResult = await this.positionService.closePosition(position.id, price, sellLevel)
            const { unitsSold, unitsKept, dollarAmount } = sellResult.sellDetails

            // Mark level as sold for rebuy purposes (allows rebuy even if units are kept)
            this.levelService.markLevelAsSold(position.threshold_level, 'below')

            const profit = (price - position.price) * unitsSold

            logger.logNotification('sell', symbol, {
                positionId: position.id,
                level: position.threshold_level,
                buyPrice: position.price,
                sellPrice: price,
                originalUnits: position.units,
                unitsSold: unitsSold,
                unitsKept: unitsKept,
                dollarAmount: dollarAmount,
                profit: profit,
                sellTriggerPrice
            })

            console.log(`🔔 SELL NOTIFICATION: Price ${price.toFixed(2)} reached sell trigger ${sellTriggerPrice.toFixed(2)}`)
            console.log(`💰 Selling ${unitsSold} units (~${dollarAmount}) at ${price.toFixed(2)}`)
            if (unitsKept > 0) {
                console.log(`🎯 Keeping ${unitsKept} units (value: ${(unitsKept * price).toFixed(2)}) for accumulation`)
            }
            console.log(`📈 Profit: ${profit.toFixed(2)}`)

            // Send Telegram notification (fire-and-forget to avoid blocking)
            telegramNotifier.notifySell({
                symbol,
                level: position.threshold_level,
                buyPrice: Number(position.price),
                sellPrice: price,
                unitsSold,
                unitsKept,
                profit
            }).catch(e => logger.error('Telegram sell notification failed', { error: e.message }))
        }
    }

    /**
     * Get strategy status
     * @param {string} symbol - Stock symbol
     * @returns {object} - Strategy status
     */
    /**
     * Get latest price from database (daily or intraday)
     */
    async getLatestPriceFromDb(symbol) {
        try {
            const queryText = `
                WITH daily_latest AS (
                    SELECT close as price, date as timestamp, 'daily' as source
                    FROM daily_prices 
                    WHERE symbol = $1
                    ORDER BY date DESC
                    LIMIT 1
                ),
                intraday_latest AS (
                    SELECT price, timestamp, 'intraday' as source
                    FROM intraday_prices 
                    WHERE symbol = $1
                    ORDER BY timestamp DESC
                    LIMIT 1
                )
                SELECT price, timestamp, source
                FROM (
                    SELECT * FROM daily_latest
                    UNION ALL
                    SELECT * FROM intraday_latest
                ) combined
                ORDER BY timestamp DESC
                LIMIT 1
            `
            const result = await query(queryText, [symbol])

            if (result.rows.length > 0) {
                return {
                    price: Number(result.rows[0].price),
                    timestamp: result.rows[0].timestamp,
                    source: result.rows[0].source
                }
            }
            return null
        } catch (error) {
            logger.error('Error fetching latest price from database', { error: error.message, symbol })
            return null
        }
    }

    async getStrategyStatus(symbol) {
        // Ensure service is initialized
        if (!this.initialized) {
            await this.initialize()
        }

        const [positions, stats, levels, latestDbPrice] = await Promise.all([
            this.positionService.getPositions(symbol),
            this.positionService.getPositionStats(symbol),
            this.levelService.getAllLevels(),
            this.getLatestPriceFromDb(symbol)
        ])

        return {
            symbol,
            highestPrice: this.levelService.highestPrice,
            levels,
            positions,
            stats,
            levelStates: this.levelService.levelStates,
            buyCounts: this.levelService.buyCounts,
            lastPrice: this.lastPrices[symbol] || null,
            latestDbPrice: latestDbPrice ? latestDbPrice.price : null,
            latestDbTimestamp: latestDbPrice ? latestDbPrice.timestamp : null,
            latestDbSource: latestDbPrice ? latestDbPrice.source : null
        }
    }

    /**
     * Get level configuration
     * @returns {object} - Level configuration
     */
    getLevelConfig() {
        return this.levelService.getConfig()
    }

    /**
     * Get position configuration
     * @returns {object} - Position configuration
     */
    getPositionConfig() {
        return this.positionService.getConfig()
    }

    /**
     * Send higher price webhook notification to n8n
     * @param {Object} notification - Notification object
     */
    async sendHigherPriceWebhook(notification) {
        try {
            // Use built-in fetch (available in Node.js 18+)
            const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/pyramid-notifications'

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(notification)
            })

            if (response.ok) {
                logger.info(`Higher price webhook notification sent successfully for ${notification.symbol}`)
            } else {
                logger.error(`Higher price webhook notification failed: ${response.status} ${response.statusText}`)
            }

        } catch (error) {
            logger.error('Error sending higher price webhook notification:', error)
        }
    }

    /**
     * Reset strategy for a symbol
     * @param {string} symbol - Stock symbol
     */
    async resetStrategy(symbol) {
        this.lastPrices[symbol] = null
        // Reset level states, buy counts, and anchor level
        this.levelService.levelStates = { below: {}, above: {} }
        this.levelService.buyCounts = {}
        this.levelService.anchorLevel = null

        // Rebuild level states from existing active positions
        await this.rebuildLevelStatesFromPositions(symbol)

        logger.info('Strategy reset', { symbol })
    }

    /**
     * Rebuild level states from existing active positions
     * @param {string} symbol - Stock symbol
     */
    async rebuildLevelStatesFromPositions(symbol) {
        try {
            const positions = await this.positionService.getActiveBuyPositions(symbol)

            for (const position of positions) {
                const level = position.threshold_level
                const direction = 'below' // Assuming all positions are below levels

                // Mark level as bought
                this.levelService.levelStates[direction][level] = 'bought'

                // Update buy counts
                const buyCountKey = `${direction}_${level}`
                this.levelService.buyCounts[buyCountKey] = (this.levelService.buyCounts[buyCountKey] || 0) + 1

                // Set anchor level to the deepest level
                if (!this.levelService.anchorLevel || level > this.levelService.anchorLevel) {
                    this.levelService.anchorLevel = level
                }
            }

            logger.info('Level states rebuilt from positions', {
                symbol,
                levelStates: this.levelService.levelStates,
                buyCounts: this.levelService.buyCounts,
                anchorLevel: this.levelService.anchorLevel,
                positionsProcessed: positions.length
            })

        } catch (error) {
            logger.error('Error rebuilding level states from positions', {
                symbol,
                error: error.message
            })
        }
    }

    /**
     * Graceful shutdown - stop active monitoring
     */
    async shutdown() {
        logger.info('🛑 Shutting down pyramid strategy service...')
        this.stopActiveMonitoring()
        logger.info('✅ Pyramid strategy service shutdown complete')
    }
}

module.exports = PyramidStrategyService


