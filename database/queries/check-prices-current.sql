-- Database Queries to Check Prices and Identify Issues
-- Updated version that works with current database structure
-- Run these queries in pgAdmin to investigate the "weird" prices

-- 1. Check overall database statistics (works with existing tables)
SELECT 
    'daily_prices' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT symbol) as unique_symbols,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM daily_prices
UNION ALL
SELECT 
    'instruments' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT symbol) as unique_symbols,
    MIN(created_at) as earliest_date,
    MAX(created_at) as latest_date
FROM instruments;

-- 2. Check if crypto_prices table exists and its stats
SELECT 
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crypto_prices') 
        THEN 'crypto_prices' 
        ELSE 'crypto_prices (table does not exist)' 
    END as table_name,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crypto_prices') 
        THEN (SELECT COUNT(*) FROM crypto_prices)
        ELSE 0 
    END as total_records,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crypto_prices') 
        THEN (SELECT COUNT(DISTINCT symbol) FROM crypto_prices)
        ELSE 0 
    END as unique_symbols,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crypto_prices') 
        THEN (SELECT MIN(timestamp) FROM crypto_prices)
        ELSE NULL 
    END as earliest_date,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crypto_prices') 
        THEN (SELECT MAX(timestamp) FROM crypto_prices)
        ELSE NULL 
    END as latest_date;

-- 3. Check instruments table for all symbols
SELECT 
    symbol,
    name,
    exchange,
    COALESCE(instrument_type, 'STOCK') as instrument_type,
    COALESCE(is_24h_trading, false) as is_24h_trading,
    created_at
FROM instruments
ORDER BY symbol;

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

-- 5. Check for any extreme or suspicious price values in daily_prices
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

-- 6. Check for data consistency issues in daily_prices
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

-- 7. Check for missing or null values in daily_prices
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

-- 8. Check for price anomalies (sudden large changes) in daily_prices
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

-- 9. Check data sources and metadata in daily_prices
SELECT 
    source,
    COUNT(*) as record_count,
    COUNT(DISTINCT symbol) as symbol_count
FROM daily_prices 
GROUP BY source
ORDER BY record_count DESC;

-- 10. Check for any recent data insertion issues in daily_prices
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

-- 11. Check table structure to see what columns exist
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('daily_prices', 'instruments')
ORDER BY table_name, ordinal_position;

-- 12. Check for any data quality issues
SELECT 
    'Data Quality Summary' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN close <= 0 THEN 1 END) as invalid_prices,
    COUNT(CASE WHEN volume < 0 THEN 1 END) as invalid_volumes,
    COUNT(CASE WHEN date > CURRENT_DATE THEN 1 END) as future_dates,
    COUNT(CASE WHEN date < '2020-01-01' THEN 1 END) as very_old_dates
FROM daily_prices;
