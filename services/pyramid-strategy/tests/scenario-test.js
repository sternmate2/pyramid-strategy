#!/usr/bin/env node

/**
 * Stern Strategy Test - Complete Scenario
 * Tests the exact scenario with step-by-step price movements
 * 
 * Scenario:
 * Current price: 200
 * Step 1: price gets to 194.95
 * Step 2: price gets to 199
 * Step 3: price gets to 182.89
 * Step 4: price gets to 199
 * Step 5: price gets to 176.86
 * Step 6: price gets to 194.95 & 182.89
 * Step 7: price gets to 182.89 & 158.77
 * Step 8: price gets to 158.77
 * Step 9: price gets to 219.07
 * Step 10: price gets to 207.01
 */

const path = require('path')

// Mock dependencies for testing
const mockQuery = async () => ({
    rows: [{ highest_price: '200.00' }]
})

const mockLogger = {
    info: (...args) => console.log('📋 INFO:', ...args),
    error: (...args) => console.error('❌ ERROR:', ...args),
    warning: (...args) => console.warn('⚠️  WARNING:', ...args),
    logNotification: (type, symbol, data) => {
        console.log(`🔔 ${type.toUpperCase()} NOTIFICATION:`, symbol, data)
    }
}

// Mock config
const mockConfig = {
    STRATEGY: {
        levelsBelow: 10,
        levelsAbove: 10,
        levelIncrement: 3.0,
        sellThresholdCents: 14
    },
    POSITION: {
        baseDollarAmount: 1000,
        incrementMultiplier: 1.0
    }
}

// Mock position service for testing
class MockPositionService {
    constructor() {
        this.positions = []
        this.nextId = 1
    }

    async createBuyPosition(symbol, price, level, buyCount) {
        const dollarAmount = 1000 // Simplified for testing
        const units = Math.floor(dollarAmount / price)
        
        const position = {
            id: this.nextId++,
            symbol,
            price,
            units,
            threshold_level: level,
            buy_count: buyCount + 1,
            dollar_amount: dollarAmount,
            action_type: 'buy',
            status: 'active',
            created_at: new Date()
        }
        
        this.positions.push(position)
        console.log(`💰 Created buy position: Level ${level}, ${units} units @ $${price.toFixed(2)} (Buy #${buyCount + 1})`)
        return position
    }

    async closePosition(positionId, sellPrice, sellLevel) {
        const position = this.positions.find(p => p.id === positionId)
        if (position) {
            position.status = 'closed'
            position.sell_price = sellPrice
            position.sell_level = sellLevel
            
            const sellPosition = {
                ...position,
                id: this.nextId++,
                action_type: 'sell',
                price: sellPrice,
                created_at: new Date()
            }
            
            this.positions.push(sellPosition)
            console.log(`💸 Closed position: Level ${position.threshold_level}, ${position.units} units @ $${sellPrice.toFixed(2)}`)
        }
        return position
    }

    async getPositions(symbol) {
        return this.positions.filter(p => p.symbol === symbol)
    }

    async getActiveBuyPositions(symbol) {
        return this.positions.filter(p => 
            p.symbol === symbol && 
            p.status === 'active' && 
            p.action_type === 'buy'
        )
    }

    async checkSellTriggers(symbol, price, levelService) {
        // Check if current price triggers any sell conditions
        const activePositions = await this.getActiveBuyPositions(symbol)
        const sellTriggers = []
        
        for (const position of activePositions) {
            const sellTriggerPrice = levelService.getSellTriggerPrice(position.threshold_level)
            
            if (sellTriggerPrice && price >= sellTriggerPrice) {
                sellTriggers.push({
                    position,
                    sellTriggerPrice,
                    sellLevel: position.threshold_level
                })
            }
        }
        
        return sellTriggers
    }

    async getPositionStats(symbol) {
        const positions = this.positions.filter(p => p.symbol === symbol)
        return {
            totalPositions: positions.length,
            activePositions: positions.filter(p => p.status === 'active').length,
            closedPositions: positions.filter(p => p.status === 'closed').length
        }
    }

    calculateBuyDollarAmountForLevel(level, buyCount) {
        return 1000 // Simplified for testing
    }

    getConfig() {
        return {
            baseDollarAmount: 1000,
            incrementMultiplier: 1.0
        }
    }
}

// Simplified Level Service for testing
class MockLevelService {
    constructor() {
        this.highestPrice = null
        this.levels = { below: {}, above: {} }
        this.levelStates = { below: {}, above: {} }
        this.buyCounts = {}
        this.anchorLevel = null
        this.testMode = false
    }

    updateHighestPrice(currentPrice) {
        if (!this.highestPrice || currentPrice > this.highestPrice) {
            this.highestPrice = currentPrice
            if (!this.testMode) {
                this.calculateLevels()
                console.log(`🏆 New highest price: $${this.highestPrice.toFixed(2)}`)
            }
        }
    }

    calculateLevels() {
        if (!this.highestPrice) return

        this.levels.below = {}
        this.levels.above = {}

        // Calculate levels below with 3% increments
        for (let i = 1; i <= 10; i++) {
            const percentage = i * 3.0
            const price = this.highestPrice * (1 - percentage / 100)
            this.levels.below[i] = {
                level: i,
                price: Math.round(price * 100) / 100,
                percentage: -percentage
            }
        }

        // Calculate levels above with 3% increments
        for (let i = 1; i <= 10; i++) {
            const percentage = i * 3.0
            const price = this.highestPrice * (1 + percentage / 100)
            this.levels.above[i] = {
                level: i,
                price: Math.round(price * 100) / 100,
                percentage: percentage
            }
        }
    }

    getAllTriggeredLevels(price, lastPrice) {
        // Only check for buys if price is dropping
        if (lastPrice && price >= lastPrice) {
            return []
        }

        const triggeredLevels = []

        for (const [level, data] of Object.entries(this.levels.below)) {
            const levelNum = parseInt(level)
            const levelPrice = data.price

            const hasDroppedThrough = price <= levelPrice && (!lastPrice || lastPrice > levelPrice)

            if (hasDroppedThrough) {
                const levelState = this.levelStates.below[levelNum]
                
                if (!levelState || levelState === 'sold') {
                    triggeredLevels.push({
                        ...data,
                        isRebuy: levelState === 'sold',
                        buyCount: this.buyCounts[`below_${levelNum}`] || 0
                    })
                }
            }
        }

        return triggeredLevels.sort((a, b) => a.level - b.level)
    }

    getBuyCountForLevel(level, direction = 'below') {
        return this.buyCounts[`${direction}_${level}`] || 0
    }

    markLevelAsBought(level, direction = 'below') {
        this.levelStates[direction][level] = 'bought'
        this.buyCounts[`${direction}_${level}`] = (this.buyCounts[`${direction}_${level}`] || 0) + 1
    }

    markLevelAsSold(level, direction = 'below') {
        this.levelStates[direction][level] = 'sold'
    }

    getSellTriggerPrice(buyLevel) {
        const sellThresholdCents = 14 / 100

        switch (buyLevel) {
            case 1:
                const level2Above = this.levels.above[2]
                return level2Above ? Math.round((level2Above.price - sellThresholdCents) * 100) / 100 : null
            case 2:
                return Math.round((this.highestPrice - sellThresholdCents) * 100) / 100
            case 3:
                const level1Below = this.levels.below[1]
                return level1Below ? Math.round((level1Below.price - sellThresholdCents) * 100) / 100 : null
            case 4:
                const level2Below = this.levels.below[2]
                return level2Below ? Math.round((level2Below.price - sellThresholdCents) * 100) / 100 : null
            case 5:
                const level3Below = this.levels.below[3]
                return level3Below ? Math.round((level3Below.price - sellThresholdCents) * 100) / 100 : null
            default:
                return null
        }
    }

    isAnchorLevel(level) {
        return this.anchorLevel === level
    }

    updateAnchorLevel(level) {
        if (this.anchorLevel === null) {
            this.anchorLevel = level
            console.log(`⚓ Set anchor level: ${level}`)
            return []
        }

        const currentAnchorPrice = this.levels.below[this.anchorLevel]?.price
        const newLevelPrice = this.levels.below[level]?.price

        if (newLevelPrice && currentAnchorPrice && newLevelPrice < currentAnchorPrice) {
            const oldAnchor = this.anchorLevel
            this.anchorLevel = level
            console.log(`⚓ Updated anchor level: ${oldAnchor} → ${level}`)
            return []
        }

        return []
    }

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

    enableTestMode() {
        this.testMode = true
    }
}

// Simplified Stern Strategy Service for testing
class MockSternStrategyService {
    constructor() {
        this.levelService = new MockLevelService()
        this.positionService = new MockPositionService()
        this.lastPrices = {}
        this.initialized = false
    }

    async initialize() {
        if (this.initialized) return

        this.levelService.updateHighestPrice(200.00)
        this.initialized = true
        mockLogger.info('Service initialized with highest price: $200.00')
    }

    async processPriceUpdate(symbol, price) {
        try {
            if (!this.initialized) {
                await this.initialize()
            }

            // Update highest price only if price increases
            if (price > this.levelService.highestPrice) {
                this.levelService.updateHighestPrice(price)
            }

            const lastPrice = this.lastPrices[symbol]

            // Check for sell triggers first
            await this.checkSellTriggers(symbol, price)

            // Check for buy triggers
            await this.checkBuyTriggers(symbol, price, lastPrice)

            // Update last price
            this.lastPrices[symbol] = price

        } catch (error) {
            mockLogger.error('Error processing price update', { symbol, price, error: error.message })
        }
    }

    async checkBuyTriggers(symbol, price, lastPrice) {
        const triggeredLevels = this.levelService.getAllTriggeredLevels(price, lastPrice)

        for (const buyLevel of triggeredLevels) {
            const levelBuyCount = this.levelService.getBuyCountForLevel(buyLevel.level, 'below')
            
            // Create buy position
            await this.positionService.createBuyPosition(
                symbol,
                price,
                buyLevel.level,
                levelBuyCount
            )

            // Mark level as bought
            this.levelService.markLevelAsBought(buyLevel.level, 'below')

            // Update anchor level
            this.levelService.updateAnchorLevel(buyLevel.level)

            const sellTriggerPrice = this.levelService.getSellTriggerPrice(buyLevel.level)
            const isAnchor = this.levelService.isAnchorLevel(buyLevel.level)
            const actionType = buyLevel.isRebuy ? 'REBUY' : 'BUY'

            console.log(`🔔 ${actionType}: Level ${buyLevel.level} @ $${price.toFixed(2)}${isAnchor ? ' (ANCHOR)' : ''}`)
            if (!isAnchor && sellTriggerPrice) {
                console.log(`🎯 Sell trigger: $${sellTriggerPrice.toFixed(2)}`)
            }
        }
    }

    async checkSellTriggers(symbol, price) {
        const sellTriggers = await this.positionService.checkSellTriggers(symbol, price, this.levelService)

        for (const { position, sellTriggerPrice } of sellTriggers) {
            if (this.levelService.isAnchorLevel(position.threshold_level)) {
                console.log(`⚓ ANCHOR PROTECTION: Skipping sell for Level ${position.threshold_level}`)
                continue
            }

            await this.positionService.closePosition(position.id, price, position.threshold_level)
            this.levelService.markLevelAsSold(position.threshold_level, 'below')

            console.log(`🔔 SELL: Level ${position.threshold_level} @ $${price.toFixed(2)} (trigger: $${sellTriggerPrice.toFixed(2)})`)
        }
    }

    async getStrategyStatus(symbol) {
        const positions = await this.positionService.getPositions(symbol)
        const stats = await this.positionService.getPositionStats(symbol)
        const levels = this.levelService.getAllLevels()

        return {
            symbol,
            highestPrice: this.levelService.highestPrice,
            levels,
            positions,
            stats,
            levelStates: this.levelService.levelStates,
            buyCounts: this.levelService.buyCounts,
            lastPrice: this.lastPrices[symbol] || null
        }
    }
}

class SternStrategyTestRunner {
    constructor() {
        this.service = new MockSternStrategyService()
        this.testResults = []
    }

    async initialize() {
        console.log('🎯 STERN STRATEGY TEST - SCENARIO EXECUTION')
        console.log('='.repeat(70))
        
        await this.service.initialize()
        
        console.log(`🏁 Starting Price: $200.00`)
        console.log(`📊 Levels calculated from highest price: $${this.service.levelService.highestPrice}`)
        
        this.displayLevels()
        console.log('\n' + '='.repeat(70))
    }

    displayLevels() {
        console.log('\n📈 CALCULATED LEVELS:')
        console.log('BELOW (Buy Levels):')
        
        const levelsBelow = this.service.levelService.levels.below
        for (let i = 1; i <= 10; i++) {
            const level = levelsBelow[i]
            if (level) {
                console.log(`  Level ${i}: $${level.price.toFixed(2)} (${level.percentage.toFixed(1)}%)`)
            }
        }
    }

    async executeStep(stepNumber, price, description = '') {
        console.log(`\n🔄 STEP ${stepNumber}: Price moves to $${price}${description ? ' - ' + description : ''}`)
        console.log('-'.repeat(50))
        
        const previousPrice = this.service.lastPrices['SPXL'] || 200.00
        
        try {
            await this.service.processPriceUpdate('SPXL', price)
            
            const stepResult = {
                step: stepNumber,
                price: price,
                previousPrice: previousPrice,
                description: description,
                timestamp: new Date().toISOString()
            }
            
            this.testResults.push(stepResult)
            await this.displayCurrentStatus()
            
        } catch (error) {
            console.error(`❌ Error in Step ${stepNumber}:`, error.message)
        }
    }

    async displayCurrentStatus() {
        try {
            const status = await this.service.getStrategyStatus('SPXL')
            
            console.log(`📊 Status: Highest: $${status.highestPrice.toFixed(2)}, Last: $${status.lastPrice?.toFixed(2) || 'N/A'}, Anchor: Level ${status.levels?.anchorLevel || 'None'}`)
            
            const activePositions = status.positions?.filter(p => p.status === 'active') || []
            if (activePositions.length > 0) {
                console.log(`🔒 Active Positions: ${activePositions.map(p => `L${p.threshold_level}@$${p.price.toFixed(2)}`).join(', ')}`)
            }
            
        } catch (error) {
            console.log(`⚠️  Status error: ${error.message}`)
        }
    }

    async runScenario() {
        await this.initialize()
        
        // Execute each step of the scenario
        await this.executeStep(1, 194.95, 'Drops through Level 1')
        await this.executeStep(2, 199.00, 'Recovers upward')
        await this.executeStep(3, 182.89, 'Drops through Level 3')
        await this.executeStep(4, 199.00, 'Recovers again')
        await this.executeStep(5, 176.86, 'Drops through Level 4')
        await this.executeStep(6, 194.95, 'Back to Level 1 area')
        await this.executeStep(7, 182.89, 'Back to Level 3 area')
        await this.executeStep(8, 158.77, 'Drops through Level 6')
        await this.executeStep(9, 219.07, 'New high!')
        await this.executeStep(10, 207.01, 'Slight pullback')
        
        await this.displayFinalSummary()
    }

    async displayFinalSummary() {
        console.log('\n' + '='.repeat(70))
        console.log('📋 FINAL TEST SUMMARY')
        console.log('='.repeat(70))
        
        try {
            const finalStatus = await this.service.getStrategyStatus('SPXL')
            
            console.log(`🏁 Final Results:`)
            console.log(`   🏆 Final Highest Price: $${finalStatus.highestPrice.toFixed(2)}`)
            console.log(`   📈 Final Price: $${finalStatus.lastPrice?.toFixed(2) || 'N/A'}`)
            console.log(`   ⚓ Final Anchor Level: ${finalStatus.levels?.anchorLevel || 'None'}`)
            
            // Count transactions
            const allPositions = finalStatus.positions || []
            const buyTransactions = allPositions.filter(p => p.action_type === 'buy').length
            const sellTransactions = allPositions.filter(p => p.action_type === 'sell').length
            
            console.log(`\n📊 Transaction Summary:`)
            console.log(`   🟢 Total Buys: ${buyTransactions}`)
            console.log(`   🔴 Total Sells: ${sellTransactions}`)
            console.log(`   🔒 Active Positions: ${allPositions.filter(p => p.status === 'active').length}`)
            
            // Show all positions
            if (allPositions.length > 0) {
                console.log(`\n📈 All Positions:`)
                allPositions.forEach(pos => {
                    const status = pos.status === 'active' ? '🔒' : '✅'
                    const sellInfo = pos.sell_price ? ` → $${pos.sell_price.toFixed(2)}` : ''
                    console.log(`   ${status} Level ${pos.threshold_level}: ${pos.units} units @ $${pos.price.toFixed(2)}${sellInfo} (${pos.action_type})`)
                })
            }
            
            // Financial summary
            const totalBuyValue = allPositions
                .filter(p => p.action_type === 'buy')
                .reduce((sum, p) => sum + (p.units * p.price), 0)
            
            const totalSellValue = allPositions
                .filter(p => p.action_type === 'sell')
                .reduce((sum, p) => sum + (p.units * p.price), 0)
            
            const currentValue = allPositions
                .filter(p => p.status === 'active')
                .reduce((sum, p) => sum + (p.units * (finalStatus.lastPrice || p.price)), 0)
            
            console.log(`\n💰 Financial Summary:`)
            console.log(`   📉 Total Invested: $${totalBuyValue.toFixed(2)}`)
            console.log(`   📈 Total Sold: $${totalSellValue.toFixed(2)}`)
            console.log(`   🔒 Current Value: $${currentValue.toFixed(2)}`)
            console.log(`   💵 Realized P&L: $${(totalSellValue - (totalBuyValue - currentValue / (finalStatus.lastPrice || 1))).toFixed(2)}`)
            
            // Step summary
            console.log(`\n📈 Step-by-Step Results:`)
            this.testResults.forEach(result => {
                const direction = result.price > result.previousPrice ? '📈' : '📉'
                console.log(`   Step ${result.step}: $${result.previousPrice.toFixed(2)} ${direction} $${result.price.toFixed(2)}${result.description ? ' - ' + result.description : ''}`)
            })
            
        } catch (error) {
            console.error(`❌ Error in final summary:`, error.message)
        }
        
        console.log('\n' + '='.repeat(70))
        console.log('✅ Test completed!')
    }
}

// Run the test
async function runTest() {
    const testRunner = new SternStrategyTestRunner()
    
    try {
        await testRunner.runScenario()
    } catch (error) {
        console.error('❌ Test failed:', error)
        console.error(error.stack)
        process.exit(1)
    }
}

if (require.main === module) {
    runTest()
}

module.exports = SternStrategyTestRunner