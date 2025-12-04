-- Database Queries to Check Prices and Identify Issues
-- Run these queries in pgAdmin to investigate the "weird" prices

-- 1. Check overall database statistics
SELECT 
    'daily_prices' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT symbol) as unique_symbols,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM daily_prices
UNION ALL
SELECT 
    'crypto_prices' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT symbol) as unique_symbols,
    MIN(timestamp) as earliest_date,
    MAX(timestamp) as latest_date
FROM crypto_prices;

-- 2. Check instruments table for all symbols
SELECT 
    symbol,
    name,
    exchange,
    instrument_type,
    is_24h_trading,
    created_at
FROM instruments
ORDER BY symbol;

-- 3. Check recent prices for BTC/USD specifically
SELECT 
    symbol,
    timestamp,
    price_usd,
    volume_24h,
    market_cap_usd,
    price_change_24h,
    price_change_percent_24h,
    source,
    created_at
FROM crypto_prices 
WHERE symbol = 'BTC/USD'
ORDER BY timestamp DESC
LIMIT 20;

-- 4. Check recent stock prices
SELECT 
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
WHERE symbol IN ('AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'IWM', 'SPY', 'QQQ')
ORDER BY symbol, date DESC
LIMIT 30;

-- 5. Check for any extreme or suspicious price values
SELECT 
    'daily_prices' as table_name,
    symbol,
    date,
    open,
    high,
    low,
    close,
    volume,
    CASE 
        WHEN close > 10000 THEN 'VERY_HIGH'
        WHEN close < 0.01 THEN 'VERY_LOW'
        WHEN close > 1000 THEN 'HIGH'
        WHEN close < 1 THEN 'LOW'
        ELSE 'NORMAL'
    END as price_category
FROM daily_prices 
WHERE close > 1000 OR close < 0.01
ORDER BY close DESC;

SELECT 
    'crypto_prices' as table_name,
    symbol,
    timestamp,
    price_usd,
    volume_24h,
    market_cap_usd,
    CASE 
        WHEN price_usd > 100000 THEN 'VERY_HIGH'
        WHEN price_usd < 0.0001 THEN 'VERY_LOW'
        WHEN price_usd > 10000 THEN 'HIGH'
        WHEN price_usd < 1 THEN 'LOW'
        ELSE 'NORMAL'
    END as price_category
FROM crypto_prices 
WHERE price_usd > 10000 OR price_usd < 0.0001
ORDER BY price_usd DESC;

-- 6. Check for data consistency issues
SELECT 
    symbol,
    COUNT(*) as total_records,
    COUNT(DISTINCT date) as unique_dates,
    COUNT(*) - COUNT(DISTINCT date) as duplicate_dates,
    MIN(close) as min_close,
    MAX(close) as max_close,
    AVG(close) as avg_close,
    STDDEV(close) as stddev_close
FROM daily_prices 
GROUP BY symbol
HAVING COUNT(*) > 1
ORDER BY total_records DESC;

-- 7. Check for missing or null values
SELECT 
    'daily_prices' as table_name,
    symbol,
    COUNT(*) as total_records,
    COUNT(CASE WHEN open IS NULL THEN 1 END) as null_open,
    COUNT(CASE WHEN high IS NULL THEN 1 END) as null_high,
    COUNT(CASE WHEN low IS NULL THEN 1 END) as null_low,
    COUNT(CASE WHEN close IS NULL THEN 1 END) as null_close,
    COUNT(CASE WHEN volume IS NULL THEN 1 END) as null_volume
FROM daily_prices 
GROUP BY symbol
HAVING COUNT(CASE WHEN open IS NULL OR high IS NULL OR low IS NULL OR close IS NULL OR volume IS NULL THEN 1 END) > 0;

SELECT 
    'crypto_prices' as table_name,
    symbol,
    COUNT(*) as total_records,
    COUNT(CASE WHEN price_usd IS NULL THEN 1 END) as null_price,
    COUNT(CASE WHEN volume_24h IS NULL THEN 1 END) as null_volume,
    COUNT(CASE WHEN market_cap_usd IS NULL THEN 1 END) as null_market_cap
FROM crypto_prices 
GROUP BY symbol
HAVING COUNT(CASE WHEN price_usd IS NULL OR volume_24h IS NULL OR market_cap_usd IS NULL THEN 1 END) > 0;

-- 8. Check for price anomalies (sudden large changes)
WITH price_changes AS (
    SELECT 
        symbol,
        date,
        close,
        LAG(close) OVER (PARTITION BY symbol ORDER BY date) as prev_close,
        ((close - LAG(close) OVER (PARTITION BY symbol ORDER BY date)) / LAG(close) OVER (PARTITION BY symbol ORDER BY date) * 100) as price_change_percent
    FROM daily_prices
    WHERE close IS NOT NULL
)
SELECT 
    symbol,
    date,
    prev_close,
    close,
    ROUND(price_change_percent, 2) as price_change_percent,
    CASE 
        WHEN ABS(price_change_percent) > 50 THEN 'EXTREME_CHANGE'
        WHEN ABS(price_change_percent) > 20 THEN 'LARGE_CHANGE'
        WHEN ABS(price_change_percent) > 10 THEN 'MODERATE_CHANGE'
        ELSE 'NORMAL_CHANGE'
    END as change_category
FROM price_changes
WHERE ABS(price_change_percent) > 20
ORDER BY ABS(price_change_percent) DESC;

-- 9. Check data sources and metadata
SELECT 
    source,
    COUNT(*) as record_count,
    COUNT(DISTINCT symbol) as symbol_count
FROM daily_prices 
GROUP BY source
ORDER BY record_count DESC;

SELECT 
    source,
    COUNT(*) as record_count,
    COUNT(DISTINCT symbol) as symbol_count
FROM crypto_prices 
GROUP BY source
ORDER BY record_count DESC;

-- 10. Check for any recent data insertion issues
SELECT 
    'daily_prices' as table_name,
    symbol,
    date,
    close,
    source,
    created_at,
    EXTRACT(EPOCH FROM (created_at - date)) / 86400 as days_difference
FROM daily_prices 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

SELECT 
    'crypto_prices' as table_name,
    symbol,
    timestamp,
    price_usd,
    source,
    created_at,
    EXTRACT(EPOCH FROM (created_at - timestamp)) / 86400 as days_difference
FROM crypto_prices 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
