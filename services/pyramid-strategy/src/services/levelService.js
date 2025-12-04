const config = require('../config')
const logger = require('../utils/logger')

class LevelService {
    constructor() {
        this.highestPrice = null
        this.levels = {
            below: {}, // Level 1-10 below highest price
            above: {}  // Level 1-10 above highest price
        }
        this.levelStates = {
            below: {}, // Track which levels are bought/sold
            above: {}
        }
        this.buyCounts = {} // Track buy counts per level
        this.anchorLevel = null // Track the current anchor level (never sold)
        this.testMode = false // Test mode prevents level recalculation
    }

    /**
     * Update highest price and handle level recalculation based on strategy
     * @param {number} currentPrice - Current price
     */
    updateHighestPrice(currentPrice) {
        if (!this.highestPrice || currentPrice > this.highestPrice) {
            const oldHighestPrice = this.highestPrice
            this.highestPrice = currentPrice

            // Always check if we need to recalculate levels (even in test mode)
            const shouldRecalculate = this.shouldRecalculateLevels(currentPrice, oldHighestPrice)

            if (shouldRecalculate) {
                logger.info('Price exceeded first level above - recalculating levels', {
                    oldHighestPrice,
                    newHighestPrice: currentPrice,
                    firstLevelAbove: this.levels.above[1]?.price,
                    testMode: this.testMode
                })

                // Store old anchor position for relocation
                const oldAnchorLevel = this.anchorLevel
                const oldAnchorPrice = oldAnchorLevel ? this.levels.below[oldAnchorLevel]?.price : null

                // Recalculate levels
                this.calculateLevels()

                // Relocate anchor to closest level
                if (oldAnchorPrice) {
                    this.relocateAnchorToClosestLevel(oldAnchorPrice)
                }
            } else {
                logger.info('Price increased but below first level above - keeping existing levels', {
                    oldHighestPrice,
                    newHighestPrice: currentPrice,
                    firstLevelAbove: this.levels.above[1]?.price,
                    testMode: this.testMode
                })
            }
        }
    }

    /**
     * Check if we should recalculate levels based on current price
     * @param {number} currentPrice - Current price
     * @param {number} oldHighestPrice - Previous highest price
     * @returns {boolean} - True if should recalculate
     */
    shouldRecalculateLevels(currentPrice, oldHighestPrice) {
        // If no levels exist yet, always recalculate
        if (!this.levels.above[1]) {
            return true
        }

        // Recalculate if current price exceeds the first level above
        const firstLevelAbove = this.levels.above[1].price
        return currentPrice >= firstLevelAbove
    }

    /**
     * Relocate anchor to the closest level to the old anchor price
     * @param {number} oldAnchorPrice - Previous anchor price
     */
    relocateAnchorToClosestLevel(oldAnchorPrice) {
        let closestLevel = null
        let smallestDifference = Infinity

        // Find the closest level below to the old anchor price
        for (const [level, data] of Object.entries(this.levels.below)) {
            const difference = Math.abs(data.price - oldAnchorPrice)
            if (difference < smallestDifference) {
                smallestDifference = difference
                closestLevel = parseInt(level)
            }
        }

        if (closestLevel) {
            this.setAnchorLevel(closestLevel)
            logger.info('Anchor relocated to closest level', {
                oldAnchorPrice,
                newAnchorLevel: closestLevel,
                newAnchorPrice: this.levels.below[closestLevel].price,
                difference: smallestDifference
            })
        }
    }

    /**
     * Calculate all levels based on highest price
     * Dynamically calculate levels with 3% increments
     */
    calculateLevels() {
        // Use the actual highest price for level calculation
        if (!this.highestPrice) {
            throw new Error('Cannot calculate levels without highest price from database')
        }
        const highestPrice = this.highestPrice

        // Clear existing levels
        this.levels.below = {}
        this.levels.above = {}

        // Calculate levels below (buy levels) with 3% increments
        for (let i = 1; i <= 10; i++) {
            const percentage = i * 3.0 // 3%, 6%, 9%, etc.
            const price = highestPrice * (1 - percentage / 100)

            this.levels.below[i] = {
                level: i,
                price: Math.round(price * 100) / 100, // Round to 2 decimal places
                percentage: -percentage
            }
        }

        // Calculate levels above (for sell triggers) with 3% increments
        for (let i = 1; i <= 10; i++) {
            const percentage = i * 3.0 // 3%, 6%, 9%, etc.
            const price = highestPrice * (1 + percentage / 100)

            this.levels.above[i] = {
                level: i,
                price: Math.round(price * 100) / 100, // Round to 2 decimal places
                percentage: percentage
            }
        }

        logger.info('Levels calculated', {
            highestPrice: highestPrice,
            levelsBelow: Object.keys(this.levels.below).length,
            levelsAbove: Object.keys(this.levels.above).length
        })
    }

    /**
     * Get the level for a given price (below highest)
     * @param {number} price - Price to check
     * @returns {object|null} - Level object or null if not found
     */
    getLevelBelow(price) {
        for (const [level, data] of Object.entries(this.levels.below)) {
            if (Math.abs(price - data.price) < 0.01) { // Allow small floating point differences
                return data
            }
        }
        return null
    }

    /**
     * Get the level for a given price (above highest)
     * @param {number} price - Price to check
     * @returns {object|null} - Level object or null if not found
     */
    getLevelAbove(price) {
        for (const [level, data] of Object.entries(this.levels.above)) {
            if (Math.abs(price - data.price) < 0.01) { // Allow small floating point differences
                return data
            }
        }
        return null
    }

    /**
     * Check if price is at a buy level (below highest)
     * @param {number} price - Price to check
     * @returns {object|null} - Level object if it's a buy level, null otherwise
     */
    isBuyLevel(price) {
        return this.getLevelBelow(price)
    }

    /**
     * Check if price is at a sell level (above highest)
     * @param {number} price - Price to check
     * @returns {object|null} - Level object if it's a sell level, null otherwise
     */
    isSellLevel(price) {
        return this.getLevelAbove(price)
    }

    /**
     * Get sell trigger price for a buy level based on cascading logic
     * @param {number} buyLevel - Buy level number
     * @returns {number|null} - Sell trigger price or null if not found
     */
    getSellTriggerPrice(buyLevel) {
        const sellThresholdCents = config.STRATEGY.sellThresholdCents / 100
        if (!this.highestPrice) {
            throw new Error('Cannot calculate sell trigger without highest price from database')
        }
        const highestPrice = this.highestPrice

        switch (buyLevel) {
            case 1:
                // Level 1 buy → sells at Level 1 above - 14¢
                const level1Above = this.levels.above[1]
                return level1Above ? Math.round((level1Above.price - sellThresholdCents) * 100) / 100 : null

            case 2:
                // Level 2 buy → sells at base level (highest price) - 14¢
                return Math.round((highestPrice - sellThresholdCents) * 100) / 100

            case 3:
                // Level 3 buy → sells at Level 1 below - 14¢
                const level1Below = this.levels.below[1]
                return level1Below ? Math.round((level1Below.price - sellThresholdCents) * 100) / 100 : null

            case 4:
                // Level 4 buy → sells at Level 2 below - 14¢
                const level2Below = this.levels.below[2]
                return level2Below ? Math.round((level2Below.price - sellThresholdCents) * 100) / 100 : null

            case 5:
                // Level 5 buy → sells at Level 3 below - 14¢
                const level3Below = this.levels.below[3]
                return level3Below ? Math.round((level3Below.price - sellThresholdCents) * 100) / 100 : null

            case 6:
                // Level 6 buy → sells at Level 4 below - 14¢
                const level4Below = this.levels.below[4]
                return level4Below ? Math.round((level4Below.price - sellThresholdCents) * 100) / 100 : null

            case 7:
                // Level 7 buy → sells at Level 5 below - 14¢
                const level5Below = this.levels.below[5]
                return level5Below ? Math.round((level5Below.price - sellThresholdCents) * 100) / 100 : null

            case 8:
                // Level 8 buy → sells at Level 6 below - 14¢
                const level6Below = this.levels.below[6]
                return level6Below ? Math.round((level6Below.price - sellThresholdCents) * 100) / 100 : null

            case 9:
                // Level 9 buy → sells at Level 7 below - 14¢
                const level7Below = this.levels.below[7]
                return level7Below ? Math.round((level7Below.price - sellThresholdCents) * 100) / 100 : null

            case 10:
                // Level 10 buy → sells at Level 8 below - 14¢
                const level8Below = this.levels.below[8]
                return level8Below ? Math.round((level8Below.price - sellThresholdCents) * 100) / 100 : null

            default:
                return null
        }
    }

    /**
     * Mark a level as bought
     * @param {number} level - Level number
     * @param {string} direction - 'below' or 'above'
     */
    markLevelAsBought(level, direction = 'below') {
        this.levelStates[direction][level] = 'bought'
        this.buyCounts[`${direction}_${level}`] = (this.buyCounts[`${direction}_${level}`] || 0) + 1
        logger.info('Level marked as bought', { level, direction, buyCount: this.buyCounts[`${direction}_${level}`] })
    }

    /**
     * Mark a level as sold
     * @param {number} level - Level number
     * @param {string} direction - 'below' or 'above'
     */
    markLevelAsSold(level, direction = 'below') {
        this.levelStates[direction][level] = 'sold'
        logger.info('Level marked as sold', { level, direction })
    }

    /**
     * Check if a level should trigger a buy (either new buy or rebuy)
     * @param {number} price - Current price
     * @returns {object|null} - Level object if should buy, null otherwise
     */
    shouldTriggerBuy(price, lastPrice) {
        console.log(`🔍 Checking buy triggers for price: ${price}, lastPrice: ${lastPrice}`)
        console.log(`🔍 Available levels:`, this.levels.below)

        // Only check for buys if price is dropping
        if (lastPrice && price >= lastPrice) {
            console.log(`❌ Price not dropping, no buy triggers`)
            return null
        }

        // Check levels below (buy levels) - find the highest level that price has dropped through
        let highestTriggeredLevel = null
        let highestLevelNum = 0

        for (const [level, data] of Object.entries(this.levels.below)) {
            const levelNum = parseInt(level)
            const levelPrice = data.price

            // Check if price has dropped through this level
            // Price should be <= level price AND (lastPrice was > level price OR lastPrice is null)
            const hasDroppedThrough = price <= levelPrice && (!lastPrice || lastPrice > levelPrice)

            console.log(`🔍 Level ${level}: price=${levelPrice}, current=${price}, last=${lastPrice}, droppedThrough=${hasDroppedThrough}`)

            if (hasDroppedThrough && levelNum > highestLevelNum) {
                const levelState = this.levelStates.below[levelNum]
                console.log(`🔍 Level ${level} dropped through! State: ${levelState}`)

                // Trigger buy if level is not bought or was sold (rebuy)
                if (!levelState || levelState === 'sold') {
                    highestTriggeredLevel = {
                        ...data,
                        isRebuy: levelState === 'sold',
                        buyCount: this.buyCounts[`below_${levelNum}`] || 0
                    }
                    highestLevelNum = levelNum
                    console.log(`✅ BUY TRIGGERED for Level ${level}`)
                }
            }
        }

        if (highestTriggeredLevel) {
            console.log(`✅ Returning highest triggered level: ${highestTriggeredLevel.level}`)
            return highestTriggeredLevel
        }

        console.log(`❌ No buy triggers found for price: ${price}`)
        return null
    }

    /**
     * Get all levels that should trigger buys when price drops through them
     * @param {number} price - Current price
     * @param {number} lastPrice - Previous price
     * @returns {Array} - Array of level objects that should trigger buys
     */
    getAllTriggeredLevels(price, lastPrice) {
        console.log(`🔍 Getting all triggered levels for price: ${price}, lastPrice: ${lastPrice}`)

        // Only check for buys if price is dropping
        if (lastPrice && price >= lastPrice) {
            console.log(`❌ Price not dropping, no buy triggers`)
            return []
        }

        const triggeredLevels = []

        // Check all levels below (buy levels)
        for (const [level, data] of Object.entries(this.levels.below)) {
            const levelNum = parseInt(level)
            const levelPrice = data.price

            // Check if price has dropped through this level
            const hasDroppedThrough = price <= levelPrice && (!lastPrice || lastPrice > levelPrice)

            console.log(`🔍 Level ${level}: price=${levelPrice}, current=${price}, last=${lastPrice}, droppedThrough=${hasDroppedThrough}`)

            if (hasDroppedThrough) {
                const levelState = this.levelStates.below[levelNum]
                console.log(`🔍 Level ${level} dropped through! State: ${levelState}`)

                // Trigger buy if level is not bought or was sold (rebuy)
                if (!levelState || levelState === 'sold') {
                    triggeredLevels.push({
                        ...data,
                        isRebuy: levelState === 'sold',
                        buyCount: this.buyCounts[`below_${levelNum}`] || 0
                    })
                    console.log(`✅ BUY TRIGGERED for Level ${level}`)
                }
            }
        }

        // Sort by level price (ascending) for proper cascading rebuy logic
        // Higher buy prices = higher priority for rebuy (same logic as sells)
        triggeredLevels.sort((a, b) => a.price - b.price)

        console.log(`✅ Found ${triggeredLevels.length} triggered levels`)
        return triggeredLevels
    }

    /**
     * Get buy count for a specific level
     * @param {number} level - Level number
     * @param {string} direction - 'below' or 'above'
     * @returns {number} - Buy count for the level
     */
    getBuyCountForLevel(level, direction = 'below') {
        return this.buyCounts[`${direction}_${level}`] || 0
    }

    /**
     * Set the anchor level (deepest level that should never be sold)
     * @param {number} level - Level number
     */
    setAnchorLevel(level) {
        const previousAnchor = this.anchorLevel
        this.anchorLevel = level
        logger.info('Anchor level set', { anchorLevel: level, previousAnchor })

        // No need to mark levels for selling - they will sell when their trigger is reached
        // The anchor protection is handled in checkSellTriggers
    }

    /**
     * Get the current anchor level
     * @returns {number|null} - Current anchor level
     */
    getAnchorLevel() {
        return this.anchorLevel
    }

    /**
     * Check if a level is the anchor level
     * @param {number} level - Level number
     * @returns {boolean} - True if this is the anchor level
     */
    isAnchorLevel(level) {
        return this.anchorLevel === level
    }

    /**
     * Check if anchor level should be updated to a new level
     * @param {number} level - Level number
     * @returns {boolean} - True if anchor should be updated
     */
    shouldUpdateAnchorLevel(level) {
        if (this.anchorLevel === null) {
            return true
        }

        // Compare prices instead of level numbers - new level should be deeper (lower price, higher level number)
        const currentAnchorPrice = this.levels.below[this.anchorLevel]?.price
        const newLevelPrice = this.levels.below[level]?.price

        if (newLevelPrice && currentAnchorPrice && newLevelPrice < currentAnchorPrice) {
            return true
        }

        return false
    }

    /**
     * Update anchor level if a deeper level is triggered
     * @param {number} level - Level number
     */
    updateAnchorLevel(level) {
        if (this.anchorLevel === null) {
            return this.setAnchorLevel(level)
        }

        // Compare prices instead of level numbers - update if new level is deeper (lower price)
        const currentAnchorPrice = this.levels.below[this.anchorLevel]?.price
        const newLevelPrice = this.levels.below[level]?.price

        if (newLevelPrice && currentAnchorPrice && newLevelPrice < currentAnchorPrice) {
            return this.setAnchorLevel(level)
        }

        return []
    }

    /**
     * Enable test mode (prevents level recalculation)
     */
    enableTestMode() {
        this.testMode = true
        logger.info('Test mode enabled - levels will not be recalculated')
    }

    /**
     * Disable test mode (allows level recalculation)
     */
    disableTestMode() {
        this.testMode = false
        logger.info('Test mode disabled - levels will be recalculated normally')
    }

    /**
     * Get all levels for display
     * @returns {object} - All levels
     */
    getAllLevels() {
        return {
            highestPrice: this.highestPrice,
            levelsBelow: this.levels.below,
            levelsAbove: this.levels.above,
            levelStates: this.levelStates,
            buyCounts: this.buyCounts,
            anchorLevel: this.anchorLevel,
            testMode: this.testMode
        }
    }

    /**
     * Set highest price for test mode
     * @param {number} price - Test highest price
     */
    setHighestPriceForTest(price) {
        this.highestPrice = price
        this.calculateLevels()
        logger.info('Test highest price set', {
            highestPrice: price,
            testMode: this.testMode
        })
    }

    /**
     * Get level configuration
     * @returns {object} - Level configuration
     */
    getConfig() {
        return {
            levelsBelow: config.STRATEGY.levelsBelow,
            levelsAbove: config.STRATEGY.levelsAbove,
            levelIncrement: config.STRATEGY.levelIncrement,
            sellThresholdCents: config.STRATEGY.sellThresholdCents
        }
    }
}

module.exports = LevelService

