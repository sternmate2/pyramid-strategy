#!/usr/bin/env node

/**
 * Real Database Test for Stern Strategy
 * 
 * This test connects to the actual PostgreSQL database to get the real highest price
 * and then runs your scenario with the correct data.
 */

const { Client } = require('pg')

class RealDatabaseSternTest {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'stock_anomaly',
            user: process.env.DB_USER || 'stockuser',
            password: process.env.DB_PASSWORD || 'securepassword123'
        }
        
        this.positions = []
        this.levelStates = { below: {} }
        this.anchorLevel = null
        this.lastPrice = null
    }
    
    async connectToDatabase() {
        const client = new Client(this.dbConfig)
        
        try {
            await client.connect()
            console.log('✅ Connected to PostgreSQL database')
            return client
        } catch (error) {
            console.error('❌ Database connection failed:', error.message)
            console.log('🔧 Make sure PostgreSQL is running and database exists')
            console.log('🔧 Check connection details in docker-compose.yml')
            throw error
        }
    }
    
    async getHighestPriceFromDB() {
        const client = await this.connectToDatabase()
        
        try {
            // This is the exact query the Stern Strategy service uses
            const queryText = `
                SELECT MAX(high) as highest_price
                FROM daily_prices 
                WHERE symbol = 'SPXL'
            `
            
            console.log('📊 Executing query:', queryText.trim())
            const result = await client.query(queryText)
            
            if (result.rows.length > 0 && result.rows[0].highest_price) {
                const highestPrice = Number(result.rows[0].highest_price)
                console.log(`🏆 Database highest price: $${highestPrice.toFixed(2)}`)
                return highestPrice
            } else {
                console.log('⚠️  No SPXL data found in database')
                console.log('📊 Using fallback price: $199.00')
                return 199.00
            }
        } finally {
            await client.end()
        }
    }
    
    async checkDatabaseContents() {
        const client = await this.connectToDatabase()
        
        try {
            // Check what SPXL data exists
            const dataCheck = await client.query(`
                SELECT 
                    symbol,
                    COUNT(*) as record_count,
                    MIN(date) as earliest_date,
                    MAX(date) as latest_date,
                    MIN(high) as lowest_high,
                    MAX(high) as highest_high
                FROM daily_prices 
                WHERE symbol = 'SPXL'
                GROUP BY symbol
            `)
            
            if (dataCheck.rows.length > 0) {
                const data = dataCheck.rows[0]
                console.log('📊 SPXL Database Summary:')
                console.log(`   Records: ${data.record_count}`)
                console.log(`   Date Range: ${data.earliest_date} to ${data.latest_date}`)
                console.log(`   High Range: $${Number(data.lowest_high).toFixed(2)} to $${Number(data.highest_high).toFixed(2)}`)
                
                return Number(data.highest_high)
            } else {
                console.log('❌ No SPXL records found in daily_prices table')
                
                // Check if table exists and has any data
                const tableCheck = await client.query(`
                    SELECT COUNT(*) as total_records
                    FROM daily_prices
                `)
                
                console.log(`📊 Total records in daily_prices: ${tableCheck.rows[0].total_records}`)
                
                if (Number(tableCheck.rows[0].total_records) === 0) {
                    console.log('⚠️  daily_prices table is empty - need to run price ingestion first')
                } else {
                    // Show what symbols exist
                    const symbolCheck = await client.query(`
                        SELECT symbol, COUNT(*) as count
                        FROM daily_prices
                        GROUP BY symbol
                        ORDER BY count DESC
                        LIMIT 5
                    `)
                    
                    console.log('📊 Available symbols:')
                    symbolCheck.rows.forEach(row => {
                        console.log(`   ${row.symbol}: ${row.count} records`)
                    })
                }
                
                return null
            }
        } finally {
            await client.end()
        }
    }
    
    calculateLevels(highestPrice) {
        this.highestPrice = highestPrice
        this.levels = { below: {} }
        
        for (let i = 1; i <= 10; i++) {
            const percentage = i * 3.0
            const price = highestPrice * (1 - percentage / 100)
            this.levels.below[i] = {
                level: i,
                price: Math.round(price * 100) / 100,
                percentage: -percentage,
                dollarAmount: 3000 * i
            }
        }
    }
    
    analyzeScenarioWithRealData(highestPrice) {
        console.log('\n🔍 ANALYZING YOUR SCENARIO WITH REAL DATABASE DATA:')
        console.log('='.repeat(60))
        
        this.calculateLevels(highestPrice)
        
        // Show calculated levels
        console.log('📈 Levels calculated from database highest price:')
        for (let i = 1; i <= 6; i++) {
            const level = this.levels.below[i]
            console.log(`   Level ${i}: $${level.price.toFixed(2)} (${level.percentage.toFixed(1)}%) → $${level.dollarAmount.toLocaleString()}`)
        }
        
        console.log('\n🔄 Step-by-step analysis:')
        
        const steps = [
            { price: 194.95, description: 'Step 1: Price to $194.95' },
            { price: 199.00, description: 'Step 2: Recovery to $199.00' },
            { price: 182.89, description: 'Step 3: Drop to $182.89' },
            { price: 199.00, description: 'Step 4: Recovery to $199.00' },
            { price: 176.86, description: 'Step 5: Drop to $176.86' }
        ]
        
        let totalInvestment = 0
        
        steps.forEach(step => {
            console.log(`\n${step.description}`)
            
            const triggeredLevels = []
            for (const [level, data] of Object.entries(this.levels.below)) {
                const levelNum = parseInt(level)
                const hasDroppedThrough = step.price <= data.price && (!this.lastPrice || this.lastPrice > data.price)
                
                if (hasDroppedThrough && !this.levelStates.below[levelNum]) {
                    triggeredLevels.push(data)
                }
            }
            
            if (triggeredLevels.length > 0) {
                console.log(`   ✅ TRIGGERS ${triggeredLevels.length} level(s):`)
                
                triggeredLevels.forEach(level => {
                    const units = Math.floor(level.dollarAmount / step.price)
                    const actualValue = units * step.price
                    totalInvestment += actualValue
                    
                    console.log(`   🔔 BUY Level ${level.level}: ${units} units @ $${step.price} = $${actualValue.toFixed(2)}`)
                    
                    this.levelStates.below[level.level] = 'bought'
                    
                    if (!this.anchorLevel) {
                        this.anchorLevel = level.level
                        console.log(`   ⚓ ANCHOR set to Level ${level.level}`)
                    } else if (level.price < this.levels.below[this.anchorLevel].price) {
                        this.anchorLevel = level.level
                        console.log(`   ⚓ NEW ANCHOR: Level ${level.level}`)
                    }
                    
                    this.positions.push({
                        level: level.level,
                        price: step.price,
                        units: units,
                        actualValue: actualValue
                    })
                })
            } else {
                console.log(`   ❌ No triggers`)
            }
            
            this.lastPrice = step.price
        })
        
        // Final summary
        console.log('\n📋 FINAL SUMMARY:')
        console.log(`💰 Total Investment: $${totalInvestment.toFixed(2)}`)
        console.log(`⚓ Final Anchor: Level ${this.anchorLevel || 'None'}`)
        console.log(`🔒 Total Positions: ${this.positions.length}`)
        
        if (this.positions.length > 0) {
            const finalPrice = 207.01
            const currentValue = this.positions.reduce((sum, pos) => sum + (pos.units * finalPrice), 0)
            console.log(`📈 Value at $${finalPrice}: $${currentValue.toFixed(2)}`)
            console.log(`💵 P&L: $${(currentValue - totalInvestment).toFixed(2)}`)
        }
    }
    
    async runFullTest() {
        console.log('🎯 STERN STRATEGY - REAL DATABASE TEST')
        console.log('='.repeat(70))
        
        try {
            // First, check database contents
            const dbHighestPrice = await this.checkDatabaseContents()
            
            if (dbHighestPrice) {
                // Use real database data
                this.analyzeScenarioWithRealData(dbHighestPrice)
            } else {
                console.log('\n⚠️  Cannot run test with real data - no SPXL records found')
                console.log('🔧 To populate database with SPXL data:')
                console.log('   1. Start the price ingestion service')
                console.log('   2. Ensure SPXL is in TRACKED_SYMBOLS')
                console.log('   3. Let it run to collect historical data')
                console.log('   4. Then run this test again')
            }
            
        } catch (error) {
            console.error('❌ Test failed:', error.message)
            console.log('\n🔧 Troubleshooting:')
            console.log('   1. Check if PostgreSQL is running: docker-compose ps')
            console.log('   2. Check database connection in docker-compose.yml')
            console.log('   3. Verify database exists: docker exec -it stock-postgres psql -U stockuser -d stock_anomaly')
        }
        
        console.log('\n' + '='.repeat(70))
        console.log('✅ Test completed!')
    }
}

// Export for testing
module.exports = RealDatabaseSternTest

// Run if called directly
if (require.main === module) {
    const test = new RealDatabaseSternTest()
    test.runFullTest().catch(console.error)
}