#!/usr/bin/env python3
"""
Database migration script to fix timestamp columns for proper market time display.
This script converts the daily_prices table from DATE to TIMESTAMP WITH TIME ZONE.
"""

import asyncio
import asyncpg
import os
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def run_migration():
    """Run the timestamp migration."""
    
    # Database connection parameters
    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', 'postgres'),
        'database': os.getenv('DB_NAME', 'stock_anomaly_system')
    }
    
    try:
        logger.info("🔌 Connecting to database...")
        conn = await asyncpg.connect(**db_config)
        logger.info("✅ Connected to database successfully")
        
        # Step 1: Add the new market_timestamp column
        logger.info("📝 Step 1: Adding market_timestamp column...")
        await conn.execute("""
            ALTER TABLE daily_prices ADD COLUMN IF NOT EXISTS market_timestamp TIMESTAMP WITH TIME ZONE;
        """)
        logger.info("✅ market_timestamp column added")
        
        # Step 2: Update existing records to use market open time (9:30 AM ET)
        logger.info("📝 Step 2: Updating existing records with market timestamps...")
        result = await conn.execute("""
            UPDATE daily_prices 
            SET market_timestamp = (date + INTERVAL '9 hours 30 minutes') AT TIME ZONE 'America/New_York'
            WHERE market_timestamp IS NULL;
        """)
        logger.info(f"✅ Updated {result.split()[-1]} records with market timestamps")
        
        # Step 3: Make the column NOT NULL
        logger.info("📝 Step 3: Making market_timestamp NOT NULL...")
        await conn.execute("""
            ALTER TABLE daily_prices ALTER COLUMN market_timestamp SET NOT NULL;
        """)
        logger.info("✅ market_timestamp column is now NOT NULL")
        
        # Step 4: Create new indexes
        logger.info("📝 Step 4: Creating new indexes...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_daily_prices_symbol_market_timestamp 
            ON daily_prices(symbol, market_timestamp DESC);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_daily_prices_market_timestamp 
            ON daily_prices(market_timestamp DESC);
        """)
        logger.info("✅ New indexes created")
        
        # Step 5: Update unique constraint
        logger.info("📝 Step 5: Updating unique constraint...")
        await conn.execute("""
            ALTER TABLE daily_prices DROP CONSTRAINT IF EXISTS daily_prices_symbol_date_unique;
        """)
        await conn.execute("""
            ALTER TABLE daily_prices ADD CONSTRAINT daily_prices_symbol_market_timestamp_unique 
            UNIQUE (symbol, market_timestamp);
        """)
        logger.info("✅ Unique constraint updated")
        
        # Step 6: Add comments
        logger.info("📝 Step 6: Adding column comments...")
        await conn.execute("""
            COMMENT ON COLUMN daily_prices.market_timestamp IS 'Actual market timestamp for the price data (was previously just date)';
        """)
        await conn.execute("""
            COMMENT ON COLUMN daily_prices.date IS 'Legacy date column - kept for backward compatibility';
        """)
        logger.info("✅ Column comments added")
        
        # Step 7: Verify the changes
        logger.info("📝 Step 7: Verifying changes...")
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'daily_prices' 
            ORDER BY ordinal_position;
        """)
        
        logger.info("📊 Current table structure:")
        for col in columns:
            logger.info(f"  {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")
        
        # Step 8: Show sample data
        logger.info("📝 Step 8: Showing sample data...")
        sample_data = await conn.fetch("""
            SELECT symbol, date, market_timestamp, close, source, created_at
            FROM daily_prices 
            ORDER BY market_timestamp DESC 
            LIMIT 5;
        """)
        
        logger.info("📊 Sample data:")
        for row in sample_data:
            logger.info(f"  {row['symbol']}: {row['date']} -> {row['market_timestamp']} | Close: ${row['close']} | Source: {row['source']}")
        
        logger.info("🎉 Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise
    finally:
        if 'conn' in locals():
            await conn.close()
            logger.info("🔌 Database connection closed")

if __name__ == "__main__":
    logger.info("🚀 Starting timestamp migration...")
    asyncio.run(run_migration())
    logger.info("✅ Migration script completed")
