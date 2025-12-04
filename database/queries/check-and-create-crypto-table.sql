-- Check and create crypto_prices table if it doesn't exist
-- Run this script to ensure the crypto_prices table is available

-- Check if crypto_prices table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crypto_prices') THEN
        -- Create crypto_prices table
        CREATE TABLE crypto_prices (
            id BIGSERIAL PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL REFERENCES instruments(symbol) ON DELETE CASCADE,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            price_usd DECIMAL(20,8) NOT NULL, -- Support high precision for crypto
            volume_24h DECIMAL(20,2),
            market_cap_usd DECIMAL(20,2),
            price_change_24h DECIMAL(10,4),
            price_change_percent_24h DECIMAL(10,4),
            source VARCHAR(50) NOT NULL,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            -- Constraints
            CONSTRAINT crypto_prices_positive_price CHECK (price_usd > 0),
            CONSTRAINT crypto_prices_positive_volume CHECK (volume_24h IS NULL OR volume_24h >= 0),
            CONSTRAINT crypto_prices_positive_market_cap CHECK (market_cap_usd IS NULL OR market_cap_usd >= 0)
        );

        -- Create indexes for crypto_prices
        CREATE INDEX idx_crypto_prices_symbol_timestamp ON crypto_prices(symbol, timestamp DESC);
        CREATE INDEX idx_crypto_prices_timestamp ON crypto_prices(timestamp DESC);
        CREATE INDEX idx_crypto_prices_source ON crypto_prices(source);

        RAISE NOTICE 'crypto_prices table created successfully';
    ELSE
        RAISE NOTICE 'crypto_prices table already exists';
    END IF;
END $$;

-- Check if instruments table has the new columns
DO $$
BEGIN
    -- Add instrument_type column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'instruments' AND column_name = 'instrument_type') THEN
        ALTER TABLE instruments ADD COLUMN instrument_type VARCHAR(20) DEFAULT 'STOCK';
        RAISE NOTICE 'Added instrument_type column to instruments table';
    END IF;

    -- Add is_24h_trading column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'instruments' AND column_name = 'is_24h_trading') THEN
        ALTER TABLE instruments ADD COLUMN is_24h_trading BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_24h_trading column to instruments table';
    END IF;
END $$;

-- Verify the table was created and show current status
SELECT 
    'crypto_prices' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT symbol) as unique_symbols,
    MIN(timestamp) as earliest_timestamp,
    MAX(timestamp) as latest_timestamp
FROM crypto_prices
UNION ALL
SELECT 
    'instruments' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT symbol) as unique_symbols,
    MIN(created_at) as earliest_timestamp,
    MAX(created_at) as latest_timestamp
FROM instruments;

-- Show crypto instruments specifically
SELECT 
    symbol,
    name,
    instrument_type,
    is_24h_trading,
    created_at
FROM instruments 
WHERE instrument_type = 'CRYPTO'
ORDER BY symbol;
