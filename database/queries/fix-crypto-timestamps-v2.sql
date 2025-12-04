-- Fix crypto timestamps migration v2
-- This script adds a market_timestamp column to crypto_prices table
-- and populates it with proper market timestamps, handling duplicates

-- Step 1: Add market_timestamp column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'crypto_prices' AND column_name = 'market_timestamp') THEN
        ALTER TABLE crypto_prices ADD COLUMN market_timestamp TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Step 2: Populate market_timestamp with unique market times
-- For crypto, we'll set market time to the start of the hour + offset to avoid duplicates
UPDATE crypto_prices 
SET market_timestamp = DATE_TRUNC('hour', timestamp) + 
                      INTERVAL '30 minutes' + 
                      INTERVAL '1 second' * EXTRACT(EPOCH FROM (timestamp - DATE_TRUNC('hour', timestamp)))
WHERE market_timestamp IS NULL;

-- Step 3: Make market_timestamp NOT NULL
ALTER TABLE crypto_prices 
ALTER COLUMN market_timestamp SET NOT NULL;

-- Step 4: Create new indexes for market_timestamp (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_crypto_prices_market_timestamp') THEN
        CREATE INDEX idx_crypto_prices_market_timestamp ON crypto_prices(market_timestamp DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_crypto_prices_symbol_market_timestamp') THEN
        CREATE INDEX idx_crypto_prices_symbol_market_timestamp ON crypto_prices(symbol, market_timestamp DESC);
    END IF;
END $$;

-- Step 5: Update the unique constraint to use market_timestamp
-- First drop the old constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'crypto_prices_symbol_timestamp_unique') THEN
        ALTER TABLE crypto_prices DROP CONSTRAINT crypto_prices_symbol_timestamp_unique;
    END IF;
END $$;

-- Then add the new constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'crypto_prices_symbol_market_timestamp_unique') THEN
        ALTER TABLE crypto_prices 
        ADD CONSTRAINT crypto_prices_symbol_market_timestamp_unique 
        UNIQUE (symbol, market_timestamp);
    END IF;
END $$;

-- Step 6: Verify the changes
SELECT 
    'crypto_prices' as table_name,
    COUNT(*) as total_records,
    COUNT(market_timestamp) as records_with_market_timestamp,
    MIN(market_timestamp) as earliest_market_time,
    MAX(market_timestamp) as latest_market_time,
    COUNT(DISTINCT market_timestamp) as unique_market_timestamps
FROM crypto_prices;
