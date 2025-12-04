-- Migration script to fix timestamp columns for proper market time display
-- This script converts the daily_prices table from DATE to TIMESTAMP WITH TIME ZONE

-- Step 1: Add a new timestamp column
ALTER TABLE daily_prices ADD COLUMN IF NOT EXISTS market_timestamp TIMESTAMP WITH TIME ZONE;

-- Step 2: Update existing records to use the date column as timestamp (set to market open time 9:30 AM ET)
UPDATE daily_prices 
SET market_timestamp = (date + INTERVAL '9 hours 30 minutes') AT TIME ZONE 'America/New_York'
WHERE market_timestamp IS NULL;

-- Step 3: Make the new column NOT NULL
ALTER TABLE daily_prices ALTER COLUMN market_timestamp SET NOT NULL;

-- Step 4: Create a new index on the timestamp column
CREATE INDEX IF NOT EXISTS idx_daily_prices_symbol_market_timestamp ON daily_prices(symbol, market_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_daily_prices_market_timestamp ON daily_prices(market_timestamp DESC);

-- Step 5: Drop the old date-based index (optional - keep for now)
-- DROP INDEX IF EXISTS idx_daily_prices_symbol_date;
-- DROP INDEX IF EXISTS idx_daily_prices_date;

-- Step 6: Add a comment explaining the change
COMMENT ON COLUMN daily_prices.market_timestamp IS 'Actual market timestamp for the price data (was previously just date)';
COMMENT ON COLUMN daily_prices.date IS 'Legacy date column - kept for backward compatibility';

-- Step 7: Update the unique constraint to use the new timestamp column
-- First drop the old constraint
ALTER TABLE daily_prices DROP CONSTRAINT IF EXISTS daily_prices_symbol_date_unique;

-- Then add a new constraint that allows multiple prices per day but with different timestamps
-- This is more flexible for intraday data
ALTER TABLE daily_prices ADD CONSTRAINT daily_prices_symbol_market_timestamp_unique 
    UNIQUE (symbol, market_timestamp);

-- Step 8: Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'daily_prices' 
ORDER BY ordinal_position;

-- Step 9: Show sample data to verify
SELECT 
    symbol, 
    date, 
    market_timestamp, 
    close, 
    source,
    created_at
FROM daily_prices 
ORDER BY market_timestamp DESC 
LIMIT 10;
