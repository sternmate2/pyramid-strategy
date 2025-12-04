#!/usr/bin/env node

/**
 * Stern Strategy Test - Corrected with Proper Buying Patterns
 * 
 * BUYING PATTERN (CORRECTED):
 * Level 1: $3,000
 * Level 2: $6,000  
 * Level 3: $9,000
 * Level 4: $12,000
 * Level 5: $15,000
 * etc. (Level × $3,000)
 */

class SternStrategyTestCorrected {
    constructor() {
        this.highestPrice = 200.00
        this.lastPrice = 200.00
        this.levels = { below: {}, above: {} }
        this.levelStates = { below: {}, above: {} }
        this.buyCounts = {}
        this.anchorLevel = null
        this.positions = []
        this.nextPositionId = 1
        this.testResults = []
        
        this.calculateLevels()
        this.displayInitialInfo()
    }
    
    calculateLevels() {
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
    
    displayInitialInfo() {
        console.log('🎯 STERN STRATEGY TEST - CORRECTED BUYING PATTERNS')
        console.log('='.repeat(70))
        console.log(`🏁 Starting Price: $${this.highestPrice.toFixed(2)}`)
        console.log('')
        console.log('💰 BUYING PATTERN (CORRECTED):')
        for (let i = 1; i <= 10; i++) {
            const dollarAmount = 3000 * i
            const level = this.levels.below[i]
            console.log(`  Level ${i}: $${level.price.toFixed(2)} (${level.percentage.toFixed(1)}%) → $${dollarAmount.toLocaleString()} investment`)
        }
        console.log('')
        console.log('='.repeat(70))
    }
    
    calculateBuyDollarAmount(level) {
        // Corrected pattern: Level 1 = $3000, Level 2 = $6000, etc.
        return 3000 * level
    }
    
    getAllTriggeredLevels(price, lastPrice) {
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
    
    processPriceUpdate(price, stepNumber, description) {
        console.log(`\n🔄 STEP ${stepNumber}: Price moves to $${price}${description ? ' - ' + description : ''}`)
        console.log('-'.repeat(50))
        
        const previousPrice = this.lastPrice
        
        // Update highest price if price increases
        if (price > this.highestPrice) {
            this.highestPrice = price
            this.calculateLevels()
            console.log(`🏆 New highest price: $${price.toFixed(2)}`)
        }
        
        // Check for buy triggers
        const triggeredLevels = this.getAllTriggeredLevels(price, previousPrice)
        
        if (triggeredLevels.length > 0) {
            console.log(`📉 Price drop detected: $${previousPrice.toFixed(2)} → $${price.toFixed(2)}`)
            console.log(`🔍 Checking levels below $${price.toFixed(2)}...`)
        }
        
        for (const buyLevel of triggeredLevels) {
            const levelBuyCount = this.buyCounts[`below_${buyLevel.level}`] || 0
            const dollarAmount = this.calculateBuyDollarAmount(buyLevel.level)
            const units = Math.floor(dollarAmount / price)
            const actualValue = units * price
            
            // Create buy position
            const position = {
                id: this.nextPositionId++,
                level: buyLevel.level,
                price: price,
                units: units,
                dollarAmount: dollarAmount,
                actualValue: actualValue,
                status: 'active',
                actionType: 'buy'
            }
            
            this.positions.push(position)
            
            // Mark level as bought
            this.levelStates.below[buyLevel.level] = 'bought'
            this.buyCounts[`below_${buyLevel.level}`] = levelBuyCount + 1
            
            // Update anchor level
            const wasFirstBuy = this.anchorLevel === null
            if (wasFirstBuy) {
                this.anchorLevel = buyLevel.level
                console.log(`⚓ FIRST BUY: Set anchor level to Level ${buyLevel.level}`)
            } else {
                const currentAnchorPrice = this.levels.below[this.anchorLevel]?.price
                const newLevelPrice = this.levels.below[buyLevel.level]?.price
                
                if (newLevelPrice && currentAnchorPrice && newLevelPrice < currentAnchorPrice) {
                    const oldAnchor = this.anchorLevel
                    this.anchorLevel = buyLevel.level
                    console.log(`⚓ NEW ANCHOR: Level ${oldAnchor} → Level ${buyLevel.level} (deeper drop)`)
                }
            }
            
            const sellTriggerPrice = this.getSellTriggerPrice(buyLevel.level)
            const isAnchor = this.anchorLevel === buyLevel.level
            const actionType = buyLevel.isRebuy ? 'REBUY' : 'BUY'
            
            console.log(`🔔 ${actionType} TRIGGERED: Level ${buyLevel.level} @ $${price.toFixed(2)}${isAnchor ? ' 🔒(ANCHOR)' : ''}`)
            console.log(`💰 Buying ${units} units with $${dollarAmount.toLocaleString()} (Level ${buyLevel.level} × $3,000)`)
            console.log(`📊 Actual investment: $${actualValue.toFixed(2)}`)
            console.log(`📈 Level ${buyLevel.level} threshold: $${buyLevel.price.toFixed(2)}`)
            
            if (!isAnchor && sellTriggerPrice) {
                console.log(`🎯 Sell trigger: $${sellTriggerPrice.toFixed(2)}`)
            } else if (isAnchor) {
                console.log(`⚓ ANCHOR POSITION: This position will NEVER be sold`)
            }
        }
        
        this.lastPrice = price
        
        // Status summary
        const activePositions = this.positions.filter(p => p.status === 'active')
        console.log(`📊 Status: Highest: $${this.highestPrice.toFixed(2)}, Current: $${this.lastPrice.toFixed(2)}, Anchor: Level ${this.anchorLevel || 'None'}`)
        
        if (activePositions.length > 0) {
            const positionsSummary = activePositions.map(p => {
                const anchorMark = p.level === this.anchorLevel ? '⚓' : ''
                return `L${p.level}@$${p.price.toFixed(2)}($${p.dollarAmount.toLocaleString()})${anchorMark}`
            }).join(', ')
            console.log(`🔒 Active Positions: ${positionsSummary}`)
        }
        
        this.testResults.push({
            step: stepNumber,
            price: price,
            previousPrice: previousPrice,
            description: description
        })
    }
    
    displayFinalSummary() {
        console.log('\n' + '='.repeat(70))
        console.log('📋 FINAL TEST SUMMARY')
        console.log('='.repeat(70))
        
        const allPositions = this.positions
        const buyTransactions = allPositions.filter(p => p.actionType === 'buy').length
        const activePositions = allPositions.filter(p => p.status === 'active').length
        
        console.log(`🏁 Final Results:`)
        console.log(`   🏆 Final Highest Price: $${this.highestPrice.toFixed(2)}`)
        console.log(`   📈 Final Price: $${this.lastPrice.toFixed(2)}`)
        console.log(`   ⚓ Final Anchor Level: ${this.anchorLevel || 'None'}`)
        
        console.log(`\n📊 Transaction Summary:`)
        console.log(`   🟢 Total Buys: ${buyTransactions}`)
        console.log(`   🔒 Active Positions: ${activePositions}`)
        
        // Show all positions with correct dollar amounts
        if (allPositions.length > 0) {
            console.log(`\n📈 All Positions (with corrected dollar amounts):`)
            let totalInvested = 0
            allPositions.forEach(pos => {
                const status = pos.status === 'active' ? '🔒' : '✅'
                const anchorMark = pos.level === this.anchorLevel ? ' ⚓ANCHOR' : ''
                console.log(`   ${status} Level ${pos.level}: ${pos.units} units @ $${pos.price.toFixed(2)} = $${pos.actualValue.toFixed(2)} (Target: $${pos.dollarAmount.toLocaleString()})${anchorMark}`)
                if (pos.status === 'active') {
                    totalInvested += pos.actualValue
                }
            })
            
            const currentValue = allPositions
                .filter(p => p.status === 'active')
                .reduce((sum, p) => sum + (p.units * this.lastPrice), 0)
            
            console.log(`\n💰 Financial Summary:`)
            console.log(`   📉 Total Invested: $${totalInvested.toFixed(2)}`)
            console.log(`   📈 Current Value: $${currentValue.toFixed(2)}`)
            console.log(`   💵 Unrealized P&L: $${(currentValue - totalInvested).toFixed(2)}`)
        }
        
        // Step summary
        console.log(`\n📈 Step-by-Step Results:`)
        this.testResults.forEach(result => {
            const direction = result.price > result.previousPrice ? '📈' : '📉'
            console.log(`   Step ${result.step}: $${result.previousPrice.toFixed(2)} ${direction} $${result.price.toFixed(2)}${result.description ? ' - ' + result.description : ''}`)
        })
        
        console.log('\n' + '='.repeat(70))
        console.log('✅ Test completed!')
    }
    
    runScenario() {
        const testSteps = [
            { price: 194.95, description: 'Drops through Level 1' },
            { price: 199.00, description: 'Recovers upward' },
            { price: 182.89, description: 'Drops through Level 3' },
            { price: 199.00, description: 'Recovers again' },
            { price: 176.86, description: 'Drops through Level 4' },
            { price: 194.95, description: 'Back to Level 1 area' },
            { price: 182.89, description: 'Back to Level 3 area' },
            { price: 158.77, description: 'Drops through Level 6' },
            { price: 219.07, description: 'New high!' },
            { price: 207.01, description: 'Slight pullback' }
        ]
        
        testSteps.forEach((step, index) => {
            this.processPriceUpdate(step.price, index + 1, step.description)
        })
        
        this.displayFinalSummary()
    }
}

// Run the corrected test
const testRunner = new SternStrategyTestCorrected()
testRunner.runScenario()
