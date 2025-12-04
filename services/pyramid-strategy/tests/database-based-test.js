#!/usr/bin/env node

/**
 * Stern Strategy Test - Using Real Database Highest Price
 * 
 * This test reads the actual highest price from the database,
 * just like the real service does, and calculates levels based on that.
 */

// Mock database query to simulate reading from database
async function mockDatabaseQuery() {
    // In a real test, we would need to connect to the actual database
    // For this simulation, let's assume we have SPXL data in the database
    
    // Example scenarios with different highest prices:
    const scenarios = [
        { highest_price: '219.50', description: 'Recent high from database' },
        { highest_price: '205.30', description: 'Alternative high' },
        { highest_price: '199.00', description: 'Fallback price if no data' }
    ]
    
    return scenarios[0] // Use the first scenario
}

class DatabaseBasedSternTest {
    constructor() {
        this.positions = []
        this.nextPositionId = 1
        this.levelStates = { below: {} }
        this.buyCounts = {}
        this.anchorLevel = null
        this.lastPrice = null
    }
    
    async initialize() {
        console.log('🎯 STERN STRATEGY TEST - USING DATABASE HIGHEST PRICE')
        console.log('='.repeat(70))
        
        // Simulate database query
        console.log('📊 Querying database for highest SPXL price...')
        const result = await mockDatabaseQuery()
        
        this.highestPrice = Number(result.highest_price)
        console.log(`🏆 Highest price from database: $${this.highestPrice.toFixed(2)} (${result.description})`)
        
        this.calculateLevels()
        this.displayLevels()
        
        console.log('\n' + '='.repeat(70))
        return this.highestPrice
    }
    
    calculateLevels() {
        this.levels = { below: {}, above: {} }
        
        // Calculate levels below with 3% increments
        for (let i = 1; i <= 10; i++) {
            const percentage = i * 3.0
            const price = this.highestPrice * (1 - percentage / 100)
            this.levels.below[i] = {
                level: i,
                price: Math.round(price * 100) / 100,
                percentage: -percentage,
                dollarAmount: 3000 * i
            }
        }
    }
    
    displayLevels() {
        console.log('\n📈 CALCULATED LEVELS (based on database highest price):')
        console.log('💰 BUYING PATTERN:')
        for (let i = 1; i <= 6; i++) {
            const level = this.levels.below[i]
            console.log(`  Level ${i}: $${level.price.toFixed(2)} (${level.percentage.toFixed(1)}%) → $${level.dollarAmount.toLocaleString()} investment`)
        }
    }
    
    analyzeYourScenario() {
        console.log('\n🔍 ANALYZING YOUR SCENARIO WITH DATABASE PRICE:')
        console.log('')
        
        const steps = [
            { price: 194.95, description: 'Step 1: Drops to $194.95' },
            { price: 199.00, description: 'Step 2: Recovers to $199.00' },
            { price: 182.89, description: 'Step 3: Drops to $182.89' },
            { price: 199.00, description: 'Step 4: Recovers to $199.00' },
            { price: 176.86, description: 'Step 5: Drops to $176.86' }
        ]
        
        steps.forEach((step, index) => {
            this.analyzeStep(step.price, step.description, index + 1)
        })
        
        this.showFinalAnalysis()
    }
    
    analyzeStep(price, description, stepNumber) {
        console.log(`🔄 ${description}`)
        
        // Check which levels would be triggered
        const triggeredLevels = []
        
        for (const [level, data] of Object.entries(this.levels.below)) {
            const levelNum = parseInt(level)
            const levelPrice = data.price
            
            // Check if this price would trigger this level
            const wouldTrigger = price <= levelPrice && (!this.lastPrice || this.lastPrice > levelPrice)
            
            if (wouldTrigger && !this.levelStates.below[levelNum]) {
                triggeredLevels.push(data)
            }
        }
        
        if (triggeredLevels.length > 0) {
            console.log(`   ✅ TRIGGERS: ${triggeredLevels.length} level(s)`)
            triggeredLevels.forEach(level => {
                const units = Math.floor(level.dollarAmount / price)
                const actualValue = units * price
                
                console.log(`   🔔 BUY Level ${level.level}: ${units} units @ $${price.toFixed(2)} = $${actualValue.toFixed(2)} (Target: $${level.dollarAmount.toLocaleString()})`)
                
                // Mark as triggered
                this.levelStates.below[level.level] = 'bought'
                
                // Update anchor
                if (!this.anchorLevel) {
                    this.anchorLevel = level.level
                    console.log(`   ⚓ FIRST BUY: Set anchor to Level ${level.level}`)
                } else if (level.price < this.levels.below[this.anchorLevel].price) {
                    this.anchorLevel = level.level
                    console.log(`   ⚓ NEW ANCHOR: Level ${level.level} (deeper drop)`)
                }
                
                // Track position
                this.positions.push({
                    level: level.level,
                    price: price,
                    units: units,
                    dollarAmount: level.dollarAmount,
                    actualValue: actualValue
                })
            })
        } else {
            // Check why no triggers
            const closestLevel = this.findClosestLevel(price)
            if (closestLevel) {
                if (price > closestLevel.price) {
                    console.log(`   ❌ NO TRIGGER: $${price.toFixed(2)} > Level ${closestLevel.level} threshold ($${closestLevel.price.toFixed(2)})`)
                } else {
                    console.log(`   ❌ NO TRIGGER: Level ${closestLevel.level} already bought`)
                }
            }
        }
        
        this.lastPrice = price
        console.log('')
    }
    
    findClosestLevel(price) {
        let closest = null
        let smallestDiff = Infinity
        
        for (const level of Object.values(this.levels.below)) {
            const diff = Math.abs(price - level.price)
            if (diff < smallestDiff) {
                smallestDiff = diff
                closest = level
            }
        }
        
        return closest
    }
    
    showFinalAnalysis() {
        console.log('📋 FINAL ANALYSIS:')
        
        if (this.positions.length > 0) {
            console.log(`🔒 Total Positions: ${this.positions.length}`)
            
            let totalInvested = 0
            this.positions.forEach(pos => {
                const anchorMark = pos.level === this.anchorLevel ? ' ⚓ANCHOR' : ''
                console.log(`   Level ${pos.level}: ${pos.units} units @ $${pos.price.toFixed(2)} = $${pos.actualValue.toFixed(2)}${anchorMark}`)
                totalInvested += pos.actualValue
            })
            
            console.log(`\n💰 Total Invested: $${totalInvested.toFixed(2)}`)
            
            // Calculate value at final price (assuming $207.01 from your scenario)
            const finalPrice = 207.01
            const currentValue = this.positions.reduce((sum, pos) => sum + (pos.units * finalPrice), 0)
            console.log(`📈 Value at $${finalPrice}: $${currentValue.toFixed(2)}`)
            console.log(`💵 Unrealized P&L: $${(currentValue - totalInvested).toFixed(2)}`)
        } else {
            console.log(`❌ No positions created in this scenario`)
        }
        
        console.log(`\n⚓ Final Anchor Level: ${this.anchorLevel || 'None'}`)
    }
    
    async runTest() {
        await this.initialize()
        this.analyzeYourScenario()
        
        console.log('\n' + '='.repeat(70))
        console.log('✅ Database-based test completed!')
        console.log('')
        console.log('🔧 TO RUN WITH REAL DATABASE:')
        console.log('   1. Connect to PostgreSQL database')
        console.log('   2. Query: SELECT MAX(high) FROM daily_prices WHERE symbol = \'SPXL\'')
        console.log('   3. Use that value as highest price for level calculations')
    }
}

// Simulate different database scenarios
async function runMultipleScenarios() {
    const scenarios = [
        { highest: 219.50, desc: 'High volatility scenario' },
        { highest: 199.00, desc: 'Your original assumption' },
        { highest: 245.20, desc: 'Very high database price' }
    ]
    
    for (const scenario of scenarios) {
        console.log('\n' + '='.repeat(40))
        console.log(`📊 SCENARIO: ${scenario.desc} (DB High: $${scenario.highest})`)
        console.log('='.repeat(40))
        
        const test = new DatabaseBasedSternTest()
        test.highestPrice = scenario.highest
        test.calculateLevels()
        
        // Show how levels change based on DB price
        console.log('Level 1 threshold:', `$${test.levels.below[1].price.toFixed(2)}`)
        console.log('Level 3 threshold:', `$${test.levels.below[3].price.toFixed(2)}`)
        
        // Quick analysis of Step 1 ($194.95)
        const step1Price = 194.95
        const level1Threshold = test.levels.below[1].price
        
        if (step1Price <= level1Threshold) {
            console.log(`✅ Step 1 ($${step1Price}) WOULD trigger Level 1 ($${level1Threshold.toFixed(2)})`)
        } else {
            console.log(`❌ Step 1 ($${step1Price}) would NOT trigger Level 1 ($${level1Threshold.toFixed(2)})`)
        }
    }
}

// Run the test
async function main() {
    const test = new DatabaseBasedSternTest()
    await test.runTest()
    
    console.log('\n' + '='.repeat(70))
    console.log('📊 MULTIPLE SCENARIO COMPARISON:')
    await runMultipleScenarios()
}

main().catch(console.error)