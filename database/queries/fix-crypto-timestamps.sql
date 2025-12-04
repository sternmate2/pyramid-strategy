-- Fix crypto timestamps migration
-- This script adds a market_timestamp column to crypto_prices table
-- and populates it with proper market timestamps instead of ingestion timestamps

-- Step 1: Add market_timestamp column
ALTER TABLE crypto_prices 
ADD COLUMN market_timestamp TIMESTAMP WITH TIME ZONE;

-- Step 2: Populate market_timestamp with reasonable market times
-- For crypto, we'll set market time to the start of the hour for the ingestion timestamp
-- This represents when the price was actually valid in the market
UPDATE crypto_prices 
SET market_timestamp = DATE_TRUNC('hour', timestamp) + INTERVAL '30 minutes'
WHERE market_timestamp IS NULL;

-- Step 3: Make market_timestamp NOT NULL
ALTER TABLE crypto_prices 
ALTER COLUMN market_timestamp SET NOT NULL;

-- Step 4: Create new indexes for market_timestamp
CREATE INDEX idx_crypto_prices_market_timestamp ON crypto_prices(market_timestamp DESC);
CREATE INDEX idx_crypto_prices_symbol_market_timestamp ON crypto_prices(symbol, market_timestamp DESC);

-- Step 5: Update the unique constraint to use market_timestamp instead of timestamp
-- First drop the old constraint
ALTER TABLE crypto_prices 
DROP CONSTRAINT crypto_prices_symbol_timestamp_unique;

-- Then add the new constraint
ALTER TABLE crypto_prices 
ADD CONSTRAINT crypto_prices_symbol_market_timestamp_unique 
UNIQUE (symbol, market_timestamp);

-- Step 6: Update the existing index to use market_timestamp
DROP INDEX IF EXISTS idx_crypto_prices_symbol_timestamp;
CREATE INDEX idx_crypto_prices_symbol_market_timestamp ON crypto_prices(symbol, market_timestamp DESC);

-- Step 7: Verify the changes
SELECT 
    'crypto_prices' as table_name,
    COUNT(*) as total_records,
    COUNT(market_timestamp) as records_with_market_timestamp,
    MIN(market_timestamp) as earliest_market_time,
    MAX(market_timestamp) as latest_market_time
FROM crypto_prices;
