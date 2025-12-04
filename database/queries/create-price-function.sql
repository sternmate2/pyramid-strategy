-- Create function for price resolution
CREATE OR REPLACE FUNCTION get_price_data_by_timeframe(
    p_symbol VARCHAR(20),
    p_timeframe VARCHAR(10),
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    ret_symbol VARCHAR(20),
    ret_timestamp TIMESTAMP WITH TIME ZONE,
    ret_open DECIMAL(12,4),
    ret_high DECIMAL(12,4),
    ret_low DECIMAL(12,4),
    ret_close DECIMAL(12,4),
    ret_volume BIGINT,
    ret_source VARCHAR(50)
) AS $$
BEGIN
    -- For 1 day chart: return 5-minute intervals if available, otherwise daily
    IF p_timeframe = '1d' THEN
        RETURN QUERY
        SELECT 
            i.symbol,
            i.timestamp,
            i.open,
            i.high,
            i.low,
            i.close,
            i.volume,
            i.source
        FROM intraday_prices i
        WHERE i.symbol = p_symbol 
          AND i.interval_minutes = 5
          AND i.timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 day'
        ORDER BY i.timestamp ASC;
        
        -- If no intraday data, fall back to daily
        IF NOT FOUND THEN
            RETURN QUERY
            SELECT 
                d.symbol,
                d.market_timestamp,
                d.open,
                d.high,
                d.low,
                d.closing_price,
                d.volume,
                d.source
            FROM daily_prices d
            WHERE d.symbol = p_symbol 
              AND d.market_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 day'
            ORDER BY d.market_timestamp ASC;
        END IF;
        
    -- For 5 day chart: return 30-minute intervals if available, otherwise daily
    ELSIF p_timeframe = '5d' THEN
        RETURN QUERY
        SELECT 
            i.symbol,
            i.timestamp,
            i.open,
            i.high,
            i.low,
            i.close,
            i.volume,
            i.source
        FROM intraday_prices i
        WHERE i.symbol = p_symbol 
          AND i.interval_minutes = 30
          AND i.timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 days'
        ORDER BY i.timestamp ASC;
        
        -- If no intraday data, fall back to daily
        IF NOT FOUND THEN
            RETURN QUERY
            SELECT 
                d.symbol,
                d.market_timestamp,
                d.open,
                d.high,
                d.low,
                d.closing_price,
                d.volume,
                d.source
            FROM daily_prices d
            WHERE d.symbol = p_symbol 
              AND d.market_timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 days'
            ORDER BY d.market_timestamp ASC;
        END IF;
        
    -- For 30+ day charts: return daily closing prices only
    ELSE
        -- Check if it's a crypto symbol
        IF p_symbol LIKE '%/%' THEN
            RETURN QUERY
            SELECT 
                c.symbol,
                c.market_timestamp,
                NULL::DECIMAL(12,4),
                NULL::DECIMAL(12,4),
                NULL::DECIMAL(12,4),
                c.closing_price_usd::DECIMAL(12,4),
                c.volume_24h::BIGINT,
                c.source
            FROM crypto_prices c
            WHERE c.symbol = p_symbol 
              AND c.market_timestamp >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
            ORDER BY c.market_timestamp ASC;
        ELSE
            RETURN QUERY
            SELECT 
                d.symbol,
                d.market_timestamp,
                d.open,
                d.high,
                d.low,
                d.closing_price,
                d.volume,
                d.source
            FROM daily_prices d
            WHERE d.symbol = p_symbol 
              AND d.market_timestamp >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
            ORDER BY d.market_timestamp ASC;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_price_data_by_timeframe TO stockuser;
