#!/usr/bin/env node

/**
 * Stern Strategy Test - ANALYSIS OF YOUR SCENARIO
 * 
 * IMPORTANT CLARIFICATION:
 * Your Step 1 price of $194.95 does NOT trigger Level 1 buy because:
 * - Level 1 threshold: $194.00 (-3% from $200.00)
 * - Step 1 price: $194.95 
 * - Since $194.95 > $194.00, no buy is triggered
 * 
 * BUYING PATTERN:
 * Level 1: $194.00 (-3%) → $3,000 investment
 * Level 2: $188.00 (-6%) → $6,000 investment  
 * Level 3: $182.00 (-9%) → $9,000 investment
 * Level 4: $176.00 (-12%) → $12,000 investment
 * Level 5: $170.00 (-15%) → $15,000 investment
 * etc. (Level × $3,000)
 */

class SternStrategyAnalysis {
    constructor() {
        this.highestPrice = 200.00
        this.levels = { below: {} }
        this.calculateLevels()
        this.analyzeScenario()
    }
    
    calculateLevels() {
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
    
    analyzeScenario() {
        console.log('🎯 STERN STRATEGY - SCENARIO ANALYSIS')
        console.log('='.repeat(70))
        console.log(`🏁 Starting Price: $${this.highestPrice.toFixed(2)}`)
        console.log('')
        
        console.log('📊 CALCULATED LEVELS AND INVESTMENT AMOUNTS:')
        for (let i = 1; i <= 6; i++) {
            const level = this.levels.below[i]
            console.log(`  Level ${i}: $${level.price.toFixed(2)} (${level.percentage.toFixed(1)}%) → $${level.dollarAmount.toLocaleString()} investment`)
        }
        console.log('')
        
        console.log('🔍 STEP-BY-STEP ANALYSIS:')
        console.log('')
        
        // Step 1 Analysis
        console.log('🔄 STEP 1: Price moves to $194.95')
        console.log(`   ❌ NO TRIGGER: $194.95 > Level 1 threshold ($194.00)`)
        console.log(`   📊 Price needs to drop to $194.00 or below to trigger Level 1`)
        console.log('')
        
        // Step 2 Analysis  
        console.log('🔄 STEP 2: Price moves to $199.00')
        console.log(`   ❌ NO TRIGGER: Price recovered upward`)
        console.log('')
        
        // Step 3 Analysis
        console.log('🔄 STEP 3: Price moves to $182.89')
        console.log(`   ✅ TRIGGERS: Price drops through multiple levels!`)
        console.log(`   📉 $199.00 → $182.89 (drops through $194.00 and $188.00)`)
        console.log(`   🔔 BUY Level 1: ${Math.floor(3000 / 182.89)} units @ $182.89 = $${(Math.floor(3000 / 182.89) * 182.89).toFixed(2)} (Target: $3,000)`)
        console.log(`   🔔 BUY Level 2: ${Math.floor(6000 / 182.89)} units @ $182.89 = $${(Math.floor(6000 / 182.89) * 182.89).toFixed(2)} (Target: $6,000)`)
        console.log(`   ⚓ Level 1 becomes ANCHOR (first buy)`)
        console.log(`   ⚓ Level 2 becomes NEW ANCHOR (deeper drop)`)
        console.log('')
        
        // Step 4 Analysis
        console.log('🔄 STEP 4: Price moves to $199.00')
        console.log(`   ❌ NO TRIGGER: Price recovered upward`)
        console.log(`   📊 No sells triggered (no sell triggers reached)`)
        console.log('')
        
        // Step 5 Analysis
        console.log('🔄 STEP 5: Price moves to $176.86')
        console.log(`   ✅ TRIGGERS: Level 4 triggered!`)
        console.log(`   📉 $199.00 → $176.86 (drops through $176.00)`)
        console.log(`   🔔 BUY Level 4: ${Math.floor(12000 / 176.86)} units @ $176.86 = $${(Math.floor(12000 / 176.86) * 176.86).toFixed(2)} (Target: $12,000)`)
        console.log(`   ⚓ Level 4 becomes NEW ANCHOR (deepest drop so far)`)
        console.log('')
        
        console.log('🔄 STEPS 6-8: Various price movements')
        console.log(`   📊 Step 6 ($194.95): Above Level 1 threshold, no triggers`)
        console.log(`   📊 Step 7 ($182.89): At previous levels, no new triggers`)
        console.log(`   📊 Step 8 ($158.77): May trigger Level 6 if drops through $164.00`)
        console.log('')
        
        // Step 9 Analysis
        console.log('🔄 STEP 9: Price moves to $219.07')
        console.log(`   🏆 NEW HIGH: $200.00 → $219.07`)
        console.log(`   📊 All levels recalculated based on new high!`)
        console.log(`   ⚠️  Previous positions remain, but new levels calculated`)
        console.log('')
        
        console.log('📋 EXPECTED FINAL POSITIONS:')
        const step3Level1 = Math.floor(3000 / 182.89)
        const step3Level2 = Math.floor(6000 / 182.89)
        const step5Level4 = Math.floor(12000 / 176.86)
        
        console.log(`   🔒 Level 1: ${step3Level1} units @ $182.89 = $${(step3Level1 * 182.89).toFixed(2)}`)
        console.log(`   🔒 Level 2: ${step3Level2} units @ $182.89 = $${(step3Level2 * 182.89).toFixed(2)} ⚓ANCHOR`)
        console.log(`   🔒 Level 4: ${step5Level4} units @ $176.86 = $${(step5Level4 * 176.86).toFixed(2)} ⚓ANCHOR (if becomes deepest)`)
        
        const totalInvested = (step3Level1 * 182.89) + (step3Level2 * 182.89) + (step5Level4 * 176.86)
        const currentValue = (step3Level1 * 207.01) + (step3Level2 * 207.01) + (step5Level4 * 207.01)
        
        console.log('')
        console.log('💰 EXPECTED FINANCIAL SUMMARY:')
        console.log(`   📉 Total Invested: $${totalInvested.toFixed(2)}`)
        console.log(`   📈 Value at $207.01: $${currentValue.toFixed(2)}`)
        console.log(`   💵 Unrealized P&L: $${(currentValue - totalInvested).toFixed(2)}`)
        
        console.log('')
        console.log('🎯 KEY INSIGHTS:')
        console.log('   1. Step 1 ($194.95) does NOT trigger Level 1 ($194.00)')
        console.log('   2. Step 3 ($182.89) triggers BOTH Level 1 AND Level 2')
        console.log('   3. Anchor level moves to deepest position (Level 2, then Level 4)')
        console.log('   4. Progressive dollar amounts: $3K, $6K, $9K, $12K, etc.')
        console.log('   5. New high in Step 9 recalculates all levels')
        
        console.log('')
        console.log('='.repeat(70))
        console.log('✅ Analysis completed!')
    }
}

// Run the analysis
const analysis = new SternStrategyAnalysis()