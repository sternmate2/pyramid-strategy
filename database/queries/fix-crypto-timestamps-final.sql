-- Fix crypto timestamps migration - Final version
-- This script properly handles duplicate market timestamps

-- Step 1: First, let's see what we have
SELECT 'Current state:' as info;
SELECT symbol, market_timestamp, timestamp, price_usd FROM crypto_prices ORDER BY market_timestamp;

-- Step 2: Fix duplicate market timestamps by adding small offsets
-- We'll use the original timestamp to create unique market timestamps
UPDATE crypto_prices 
SET market_timestamp = DATE_TRUNC('hour', timestamp) + 
                      INTERVAL '30 minutes' + 
                      INTERVAL '1 second' * EXTRACT(SECOND FROM timestamp) +
                      INTERVAL '1 microsecond' * EXTRACT(MICROSECONDS FROM timestamp)
WHERE market_timestamp IS NOT NULL;

-- Step 3: Verify uniqueness
SELECT 'After fixing duplicates:' as info;
SELECT symbol, market_timestamp, timestamp, price_usd FROM crypto_prices ORDER BY market_timestamp;

-- Step 4: Now add the unique constraint
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'crypto_prices_symbol_timestamp_unique') THEN
        ALTER TABLE crypto_prices DROP CONSTRAINT crypto_prices_symbol_timestamp_unique;
    END IF;
END $$;

-- Add the new constraint
ALTER TABLE crypto_prices 
ADD CONSTRAINT crypto_prices_symbol_market_timestamp_unique 
UNIQUE (symbol, market_timestamp);

-- Step 5: Final verification
SELECT 
    'Final verification:' as info,
    COUNT(*) as total_records,
    COUNT(market_timestamp) as records_with_market_timestamp,
    MIN(market_timestamp) as earliest_market_time,
    MAX(market_timestamp) as latest_market_time,
    COUNT(DISTINCT market_timestamp) as unique_market_timestamps
FROM crypto_prices;
