const { query } = require('../utils/database')
const config = require('../config')
const logger = require('../utils/logger')

class PositionService {
    constructor() {
        this.baseDollarAmount = config.STRATEGY.baseDollarAmount
        this.dollarIncrement = config.STRATEGY.dollarIncrement
    }

    /**
     * Create a new buy position
     * @param {string} symbol - Stock symbol
     * @param {number} price - Buy price
     * @param {number} level - Buy level
     * @param {number} buyCount - Current buy count
     * @returns {object} - Created position
     */
    async createBuyPosition(symbol, price, level, buyCount, isAnchor = false) {
        const dollarAmount = this.calculateBuyDollarAmountForLevel(level, buyCount)
        const units = Math.floor(dollarAmount / price)
        const totalValue = units * price

        const result = await query(`
      INSERT INTO position_tracking (
        symbol, 
        price, 
        units, 
        total_value, 
        threshold_level, 
        threshold_price,
        position_type,
        dollar_amount,
        status,
        is_anchor,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `, [symbol, price, units, totalValue, level, price, 'BUY', dollarAmount, 'ACTIVE', isAnchor])

        const position = result.rows[0]

        logger.logPosition('buy_created', symbol, {
            positionId: position.id,
            buyPrice: price,
            units,
            dollarAmount,
            level,
            totalValue
        })

        return position
    }

    /**
     * Update position anchor flag
     * @param {string} positionId - Position ID
     * @param {boolean} isAnchor - Anchor flag
     * @returns {object} - Updated position
     */
    async updatePositionAnchorFlag(positionId, isAnchor) {
        const result = await query(`
            UPDATE position_tracking 
            SET is_anchor = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [isAnchor, positionId])

        if (result.rows.length === 0) {
            throw new Error(`Position ${positionId} not found`)
        }

        return result.rows[0]
    }

    /**
     * Get position statistics
     * @param {string} symbol - Stock symbol
     * @returns {object} - Statistics
     */
    async getPositionStats(symbol) {
        const result = await query(`
      SELECT 
        COUNT(*) as total_positions,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_positions,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_positions,
        COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN total_value ELSE 0 END), 0) as active_value,
        COALESCE(SUM(CASE WHEN status = 'CLOSED' THEN (closed_price - price) * units ELSE 0 END), 0) as total_profit
      FROM position_tracking 
      WHERE symbol = $1
    `, [symbol])

        return result.rows[0]
    }

    /**
     * Close a position (sell) - using dollar amount based selling
     * @param {number} positionId - Position ID
     * @param {number} sellPrice - Sell price
     * @param {number} sellLevel - Sell level
     * @returns {object} - Updated position with remaining units
     */
    async closePosition(positionId, sellPrice, sellLevel) {
        // First get the position to access dollar_amount
        const positionResult = await query(`
            SELECT * FROM position_tracking WHERE id = $1
        `, [positionId])

        if (positionResult.rows.length === 0) {
            throw new Error(`Position ${positionId} not found`)
        }

        const position = positionResult.rows[0]
        const dollarAmount = position.dollar_amount

        // Calculate units to sell based on dollar amount and sell price
        const unitsToSell = Math.floor(dollarAmount / sellPrice)
        const remainingUnits = Math.max(0, position.units - unitsToSell) // Ensure non-negative

        // Handle case where we need to sell more units than we have
        const actualUnitsToSell = Math.min(unitsToSell, position.units)

        // Handle kept units by moving them to accumulation
        if (remainingUnits > 0) {
            // Move kept units to accumulation (permanent storage)
            await this.addToLevelAccumulation(
                position.symbol,
                position.threshold_level,
                position.price,
                remainingUnits,
                remainingUnits * position.price,
                positionId
            )

            console.log(`📦 ACCUMULATION: Moved ${remainingUnits} units to permanent accumulation for Level ${position.threshold_level}`)
        }

        // Always close the position completely when selling
        // Kept units are now in accumulation and won't be sold again
        const result = await query(`
            UPDATE position_tracking 
            SET 
                closed_price = $1,
                status = 'CLOSED',
                closed_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [sellPrice, positionId])

        const updatedPosition = result.rows[0]

        logger.logPosition('position_sold', position.symbol, {
            positionId: position.id,
            buyPrice: position.price,
            sellPrice: sellPrice,
            originalUnits: position.units,
            unitsSold: actualUnitsToSell,
            unitsKept: remainingUnits,
            dollarAmount: dollarAmount,
            level: position.threshold_level,
            sellLevel: sellLevel
        })

        // Return sell details
        return {
            ...updatedPosition,
            sellDetails: {
                unitsSold: actualUnitsToSell,
                unitsKept: remainingUnits, // These are now in accumulation
                sellPrice: sellPrice,
                dollarAmount: dollarAmount
            }
        }
    }

    /**
     * Get active buy positions for a symbol
     * @param {string} symbol - Stock symbol
     * @returns {Array} - Active positions
     */
    async getActiveBuyPositions(symbol) {
        const result = await query(`
      SELECT * FROM position_tracking 
      WHERE symbol = $1 AND status = 'ACTIVE'
      ORDER BY created_at ASC
    `, [symbol])

        return result.rows
    }

    /**
     * Get all positions for a symbol
     * @param {string} symbol - Stock symbol
     * @returns {Array} - All positions
     */
    async getPositions(symbol) {
        const result = await query(`
      SELECT * FROM position_tracking 
      WHERE symbol = $1
      ORDER BY created_at DESC
    `, [symbol])

        return result.rows
    }

    /**
     * Check for sell triggers based on current price
     * @param {string} symbol - Stock symbol
     * @param {number} currentPrice - Current price
     * @param {object} levelService - Level service instance
     * @returns {Array} - Positions to sell
     */
    async checkSellTriggers(symbol, currentPrice, levelService) {
        const activePositions = await this.getActiveBuyPositions(symbol)
        const positionsToSell = []

        // Sort positions by buy price (ascending) for proper cascading logic
        // Lower buy prices = higher profit potential = sell first
        const sortedPositions = activePositions.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))

        for (const position of sortedPositions) {
            const sellTriggerPrice = levelService.getSellTriggerPrice(position.threshold_level)
            const isAnchor = levelService.isAnchorLevel(position.threshold_level)

            console.log(`🔍 Checking position Level ${position.threshold_level}: sellTrigger=${sellTriggerPrice}, currentPrice=${currentPrice}, isAnchor=${isAnchor}`)

            // Sell if trigger reached AND not anchor
            if (sellTriggerPrice && currentPrice >= sellTriggerPrice && !isAnchor) {
                positionsToSell.push({
                    position,
                    sellTriggerPrice,
                    sellLevel: position.threshold_level
                })
            }
        }

        return positionsToSell
    }

    /**
     * Calculate buy dollar amount based on buy count
     * @param {number} buyCount - Current buy count
     * @returns {number} - Dollar amount
     */
    calculateBuyDollarAmount(buyCount) {
        // Cascading pattern: 3k, 6k, 9k, 12k, etc. (incrementing by 3k each time)
        return this.baseDollarAmount + (buyCount * this.dollarIncrement)
    }

    /**
     * Calculate buy dollar amount for a specific level
     * @param {number} level - Level number
     * @param {number} levelBuyCount - Buy count for this specific level
     * @returns {number} - Dollar amount
     */
    calculateBuyDollarAmountForLevel(level, levelBuyCount) {
        // Pattern: 3k, 6k, 9k, 12k, 15k, etc. (3k * level)
        return this.baseDollarAmount * level
    }

    /**
     * Get position for a specific level
     * @param {string} symbol - Stock symbol
     * @param {number} level - Threshold level
     * @returns {object|null} - Position or null if not found
     */
    async getPositionForLevel(symbol, level) {
        const result = await query(`
            SELECT * FROM position_tracking 
            WHERE symbol = $1 AND threshold_level = $2 AND status = 'ACTIVE'
            ORDER BY created_at DESC
            LIMIT 1
        `, [symbol, level])

        return result.rows.length > 0 ? result.rows[0] : null
    }

    /**
     * Add units to existing position (rebuy)
     * @param {number} positionId - Position ID
     * @param {number} additionalUnits - Units to add
     * @param {number} additionalValue - Value to add
     * @returns {object} - Updated position
     */
    async addToExistingPosition(positionId, additionalUnits, additionalValue) {
        const result = await query(`
            UPDATE position_tracking 
            SET 
                units = units + $1,
                total_value = total_value + $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [additionalUnits, additionalValue, positionId])

        if (result.rows.length === 0) {
            throw new Error(`Position ${positionId} not found`)
        }

        return result.rows[0]
    }

    /**
     * Add units to level accumulation (permanent storage)
     * @param {string} symbol - Stock symbol
     * @param {number} level - Level number
     * @param {number} buyPrice - Original buy price
     * @param {number} units - Units to accumulate
     * @param {number} totalValue - Total value of units
     * @param {string} originalPositionId - Original position ID
     * @returns {object} - Accumulation record
     */
    async addToLevelAccumulation(symbol, level, buyPrice, units, totalValue, originalPositionId = null) {
        const result = await query(`
            INSERT INTO level_accumulation 
            (symbol, level, buy_price, units, total_value, original_position_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [symbol, level, buyPrice, units, totalValue, originalPositionId])

        return result.rows[0]
    }

    /**
     * Get accumulated units for a symbol
     * @param {string} symbol - Stock symbol
     * @returns {Array} - Array of accumulation records
     */
    async getAccumulatedUnits(symbol) {
        const result = await query(`
            SELECT * FROM level_accumulation 
            WHERE symbol = $1
            ORDER BY level, created_at DESC
        `, [symbol])

        return result.rows
    }

    /**
     * Get accumulated units for a specific level
     * @param {string} symbol - Stock symbol
     * @param {number} level - Level number
     * @returns {Array} - Array of accumulation records for the level
     */
    async getAccumulatedUnitsForLevel(symbol, level) {
        const result = await query(`
            SELECT * FROM level_accumulation 
            WHERE symbol = $1 AND level = $2
            ORDER BY created_at DESC
        `, [symbol, level])

        return result.rows
    }

    /**
     * Get total accumulated units and value for a symbol
     * @param {string} symbol - Stock symbol
     * @returns {object} - Summary of accumulated units
     */
    async getAccumulationSummary(symbol) {
        const result = await query(`
            SELECT 
                COUNT(*) as total_records,
                SUM(units) as total_units,
                SUM(total_value) as total_value,
                AVG(buy_price) as average_buy_price
            FROM level_accumulation 
            WHERE symbol = $1
        `, [symbol])

        return result.rows[0]
    }

    /**
     * Get configuration
     * @returns {object} - Configuration
     */
    getConfig() {
        return {
            baseDollarAmount: this.baseDollarAmount,
            dollarIncrement: this.dollarIncrement
        }
    }
}

module.exports = PositionService


