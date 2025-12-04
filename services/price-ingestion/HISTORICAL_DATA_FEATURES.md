# Historical Data Population & Instrument Addition Features

This document describes the new features added to the price ingestion service for automatic historical data population and dynamic instrument addition.

## 🎯 **Overview**

The price ingestion service now includes intelligent historical data management that:

1. **Automatically detects** when instruments need historical data
2. **Respects API limits** to avoid rate limiting issues
3. **Validates data quality** before storage
4. **Supports dynamic addition** of new instruments
5. **Maximizes data coverage** within free API tier constraints

## 📊 **Historical Data Population Logic**

### **When Historical Data is Populated**

The service automatically populates historical data when:

- **New instruments** are added to the service
- **Existing instruments** have insufficient data (< 90 days)
- **Data is outdated** (latest price > 7 days old)
- **Service starts up** and detects missing data

### **API Limits & Constraints**

The service respects free API tier limitations:

| Data Source | Max Days | Rate Limit | Best For |
|-------------|----------|------------|----------|
| **CoinGecko** | 90 days | 50 calls/minute | Cryptocurrencies |
| **Finnhub** | 90 days | 58 calls/minute | Stocks |
| **Yahoo Finance** | 90 days | 30 calls/minute | Stocks |
| **Alpha Vantage** | 90 days | 1 calls/minute | Stocks |

**Maximum Historical Data**: 90 days (3 months) for all instruments

### **Data Validation**

All historical data is validated before storage:

- ✅ **Price values** must be positive
- ✅ **Timestamps** must be reasonable (not too far in past/future)
- ✅ **Data consistency** (high ≥ low, etc.)
- ✅ **Required fields** must be present

## ➕ **Adding New Instruments**

### **Automatic Process**

When a new instrument is added:

1. **Symbol validation** - Checks if already tracked
2. **Data source selection** - Chooses best available source
3. **Historical data fetch** - Retrieves up to 90 days of data
4. **Database storage** - Bulk storage with validation
5. **Cache update** - Stores latest price in Redis
6. **Scheduler integration** - Adds to appropriate ingestion schedule

### **Manual Addition via Code**

```python
from src.ingester import PriceIngester

# Initialize ingester
ingester = PriceIngester()
await ingester.initialize()

# Add new instrument
success = await ingester.add_new_instrument("NVDA")
if success:
    print("✅ NVDA added successfully with historical data")
else:
    print("❌ Failed to add NVDA")
```

### **Service-Level Addition**

```python
from main import IngestionService

# Initialize service
service = IngestionService()
await service.start()

# Add new instrument
success = await service.add_new_instrument("ETH/USD")
if success:
    print("✅ ETH/USD added to service")
else:
    print("❌ Failed to add ETH/USD")
```

## 🔍 **Monitoring & Health Checks**

### **Service Health Status**

```python
# Get service health
health = await service.health_check()
print(f"Status: {health['status']}")
print(f"Tracked symbols: {health['tracked_symbols']}")
print(f"Database: {health['database']}")
print(f"Cache: {health['cache']}")
```

### **Historical Data Status**

```python
# Check if symbol needs historical data
needs_data = await db_manager.needs_historical_population("AAPL", min_days=90)
if needs_data:
    print("📊 AAPL needs historical data population")
else:
    print("✅ AAPL has sufficient historical data")

# Get data limits for symbol
limits = db_manager.get_historical_data_limits("BTC/USD")
print(f"Max days: {limits['max_days']}")
print(f"API limits: {limits['api_limits']}")
```

## 🧪 **Testing the Features**

### **Run the Test Script**

```bash
cd services/price-ingestion
python test_instrument_addition.py
```

This script demonstrates:
- Adding new stock symbols (NVDA)
- Adding new crypto symbols (ETH/USD)
- Historical data validation
- API limit checking
- Duplicate symbol handling

### **Expected Output**

```
🧪 Testing instrument addition functionality...
✅ Ingester initialized successfully
📊 Current tracked symbols: ['SPY', 'QQQ', 'IWM', 'BTC/USD']
➕ Testing addition of new stock: NVDA
📊 NVDA: Needs historical data population
📅 NVDA: Maximum historical data allowed: 90 days
🎯 Using yahoo for NVDA historical data
📥 Received 90 historical data points for NVDA
✅ Successfully populated NVDA with 90 historical data points
✅ NVDA added to tracking list
✅ Successfully added NVDA
...
🎉 Instrument addition testing completed successfully!
```

## ⚙️ **Configuration**

### **Environment Variables**

The service uses existing configuration:

- `TRACKED_SYMBOLS` - Initial symbols to track
- `REALTIME_INTERVAL` - Ingestion frequency
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_HOST/PORT` - Redis cache connection

### **API Keys Required**

- `FINNHUB_API_KEY` - For stock data
- `ALPHAVANTAGE_API_KEY` - For historical stock data
- CoinGecko - No API key required (free tier)

## 🚀 **Deployment**

### **Rebuild and Restart**

After updating the code:

```bash
cd stock-anomaly-system
docker-compose build price-ingestion
docker-compose up -d price-ingestion
docker-compose logs price-ingestion -f
```

### **Verify New Features**

1. **Check startup logs** for historical data population
2. **Test adding new instruments** via the test script
3. **Monitor database** for new historical data
4. **Verify cache** contains latest prices

## 🔧 **Troubleshooting**

### **Common Issues**

1. **API Rate Limiting**
   - Service automatically respects rate limits
   - Check logs for rate limit warnings
   - Consider upgrading to paid API tiers

2. **Historical Data Failures**
   - Check data source availability
   - Verify API keys are valid
   - Check database connection

3. **Validation Errors**
   - Review price data quality
   - Check timestamp formats
   - Verify symbol formats

### **Log Analysis**

Key log messages to monitor:

- `📊 {symbol}: Needs historical data population`
- `✅ Successfully populated {symbol} with {count} historical data points`
- `➕ Adding new instrument: {symbol}`
- `⚠️  Rate limit exceeded` (if using free APIs too aggressively)

## 📈 **Performance Considerations**

### **Optimizations**

- **Bulk database operations** for historical data
- **Smart data source selection** based on symbol type
- **Rate limit awareness** to avoid API throttling
- **Cache-first approach** for frequently accessed data

### **Resource Usage**

- **Database**: Additional storage for historical data
- **Memory**: Minimal increase for validation logic
- **Network**: API calls for historical data population
- **CPU**: Data validation and processing

## 🔮 **Future Enhancements**

Potential improvements:

1. **Incremental updates** - Only fetch missing data
2. **Data quality scoring** - Rate data source reliability
3. **Automatic symbol discovery** - Find related instruments
4. **Advanced scheduling** - Optimize ingestion timing
5. **Data compression** - Store historical data more efficiently

---

For questions or issues, check the service logs and refer to the troubleshooting section above.
