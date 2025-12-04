-- Stock Anomaly Detection System Database Schema
-- Create all tables and indexes

\c stock_anomaly;

-- =============================================================================
-- INSTRUMENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS instruments (
    symbol VARCHAR(20) PRIMARY KEY, -- Increased for crypto pairs like BTC/USD
    name VARCHAR(255),
    exchange VARCHAR(50),
    sector VARCHAR(100),
    industry VARCHAR(100),
    market_cap BIGINT,
    instrument_type VARCHAR(20) DEFAULT 'STOCK', -- STOCK, CRYPTO, FOREX, etc.
    is_24h_trading BOOLEAN DEFAULT FALSE, -- For crypto that trades 24/7
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for instruments
CREATE INDEX IF NOT EXISTS idx_instruments_sector ON instruments(sector);
CREATE INDEX IF NOT EXISTS idx_instruments_exchange ON instruments(exchange);
CREATE INDEX IF NOT EXISTS idx_instruments_market_cap ON instruments(market_cap);
CREATE INDEX IF NOT EXISTS idx_instruments_type ON instruments(instrument_type);
CREATE INDEX IF NOT EXISTS idx_instruments_24h_trading ON instruments(is_24h_trading);

-- =============================================================================
-- DAILY PRICES TABLE  
-- =============================================================================
CREATE TABLE IF NOT EXISTS daily_prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL REFERENCES instruments(symbol) ON DELETE CASCADE,
    date DATE NOT NULL,
    open DECIMAL(12,4),
    high DECIMAL(12,4),
    low DECIMAL(12,4),
    close DECIMAL(12,4) NOT NULL,
    volume BIGINT,
    adj_close DECIMAL(12,4),
    source VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT daily_prices_symbol_date_unique UNIQUE (symbol, date),
    CONSTRAINT daily_prices_positive_prices CHECK (
        (open IS NULL OR open > 0) AND
        (high IS NULL OR high > 0) AND
        (low IS NULL OR low > 0) AND
        close > 0 AND
        (adj_close IS NULL OR adj_close > 0)
    ),
    CONSTRAINT daily_prices_logical_prices CHECK (
        (high IS NULL OR low IS NULL OR high >= low) AND
        (open IS NULL OR high IS NULL OR open <= high) AND
        (open IS NULL OR low IS NULL OR open >= low) AND
        (close <= high OR high IS NULL) AND
        (close >= low OR low IS NULL)
    )
);

-- Create indexes for daily_prices
CREATE INDEX IF NOT EXISTS idx_daily_prices_symbol_date ON daily_prices(symbol, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_prices_source ON daily_prices(source);
CREATE INDEX IF NOT EXISTS idx_daily_prices_volume ON daily_prices(volume DESC) WHERE volume IS NOT NULL;

-- =============================================================================
-- INTRADAY PRICES TABLE (Optional - for future use)
-- =============================================================================
CREATE TABLE IF NOT EXISTS intraday_prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL REFERENCES instruments(symbol) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    price DECIMAL(12,4) NOT NULL,
    volume INTEGER,
    source VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT intraday_prices_positive_price CHECK (price > 0),
    CONSTRAINT intraday_prices_positive_volume CHECK (volume IS NULL OR volume >= 0)
);

-- Create indexes for intraday_prices
CREATE INDEX IF NOT EXISTS idx_intraday_prices_symbol_timestamp ON intraday_prices(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_intraday_prices_timestamp ON intraday_prices(timestamp DESC);

-- =============================================================================
-- CRYPTOCURRENCY PRICES TABLE (24/7 trading)
-- =============================================================================
CREATE TABLE IF NOT EXISTS crypto_prices (
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
CREATE INDEX IF NOT EXISTS idx_crypto_prices_symbol_timestamp ON crypto_prices(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_prices_timestamp ON crypto_prices(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_prices_source ON crypto_prices(source);

-- =============================================================================
-- API USAGE TRACKING TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_usage (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    endpoint VARCHAR(200),
    symbol VARCHAR(10),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for api_usage
CREATE INDEX IF NOT EXISTS idx_api_usage_source_timestamp ON api_usage(source, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_status ON api_usage(status_code);

-- =============================================================================
-- POSITION TRACKING TABLE (for Pyramid Strategy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS position_tracking (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(12,4) NOT NULL,
    units INTEGER NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    threshold_level INTEGER NOT NULL,
    threshold_price DECIMAL(12,4) NOT NULL,
    position_type VARCHAR(10) NOT NULL CHECK (position_type IN ('BUY', 'SELL')),
    dollar_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'CANCELLED')),
    is_anchor BOOLEAN DEFAULT FALSE,
    closed_price DECIMAL(12,4),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for position_tracking
CREATE INDEX IF NOT EXISTS idx_position_tracking_symbol ON position_tracking(symbol);
CREATE INDEX IF NOT EXISTS idx_position_tracking_status ON position_tracking(status);
CREATE INDEX IF NOT EXISTS idx_position_tracking_symbol_status ON position_tracking(symbol, status);

-- =============================================================================
-- ANOMALIES TABLE (For future anomaly detection features)
-- =============================================================================
CREATE TABLE IF NOT EXISTS anomalies (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL REFERENCES instruments(symbol) ON DELETE CASCADE,
    anomaly_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    price_at_detection DECIMAL(12,4),
    volume_at_detection BIGINT,
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    INDEX idx_anomalies_symbol_detected ON (symbol, detected_at DESC),
    INDEX idx_anomalies_detected_at ON (detected_at DESC),
    INDEX idx_anomalies_severity ON (severity),
    INDEX idx_anomalies_type ON (anomaly_type),
    INDEX idx_anomalies_unresolved ON (symbol, detected_at) WHERE resolved_at IS NULL
);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_instruments_updated_at ON instruments;
CREATE TRIGGER update_instruments_updated_at
    BEFORE UPDATE ON instruments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_prices_updated_at ON daily_prices;
CREATE TRIGGER update_daily_prices_updated_at
    BEFORE UPDATE ON daily_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Latest prices view
CREATE OR REPLACE VIEW latest_prices AS
SELECT DISTINCT ON (symbol)
    symbol,
    date,
    open,
    high, 
    low,
    close,
    volume,
    source,
    created_at
FROM daily_prices
ORDER BY symbol, date DESC, created_at DESC;

-- Price changes view (with previous day comparison)
CREATE OR REPLACE VIEW price_changes AS
SELECT 
    symbol,
    date,
    close,
    LAG(close) OVER (PARTITION BY symbol ORDER BY date) as previous_close,
    close - LAG(close) OVER (PARTITION BY symbol ORDER BY date) as price_change,
    CASE 
        WHEN LAG(close) OVER (PARTITION BY symbol ORDER BY date) > 0 
        THEN ROUND(((close - LAG(close) OVER (PARTITION BY symbol ORDER BY date)) 
                   / LAG(close) OVER (PARTITION BY symbol ORDER BY date) * 100)::numeric, 2)
        ELSE NULL 
    END as percent_change
FROM daily_prices
ORDER BY symbol, date DESC;

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant permissions to the application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stockuser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO stockuser;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO stockuser;

-- Grant usage on views
GRANT SELECT ON latest_prices TO stockuser;
GRANT SELECT ON price_changes TO stockuser;

-- Explicitly grant permissions on position_tracking
GRANT SELECT, INSERT, UPDATE, DELETE ON position_tracking TO stockuser;
GRANT USAGE, SELECT ON SEQUENCE position_tracking_id_seq TO stockuser;

-- =============================================================================
-- PERFORMANCE OPTIMIZATIONS
-- =============================================================================

-- Enable auto-vacuum for better performance
ALTER TABLE daily_prices SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE intraday_prices SET (autovacuum_vacuum_scale_factor = 0.05);

-- Table statistics
ANALYZE instruments;
ANALYZE daily_prices;
ANALYZE intraday_prices;
ANALYZE api_usage;