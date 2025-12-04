# Enhanced Logging for Price Ingestion Service

## Overview

The price ingestion service has been enhanced with comprehensive logging to help identify why prices aren't being inserted into the database. The logging system now provides detailed information about every step of the ingestion process.

## Log Files

The service now creates multiple log files for different purposes:

- **`logs/price-ingestion.log`** - Main log file with all log levels
- **`logs/price-ingestion-error.log`** - Error-only log file for quick error review
- **Console output** - Real-time logging to stdout

## Log Levels

The service uses the following log levels (from most to least verbose):

- **DEBUG** - Detailed debugging information
- **INFO** - General information about service operation
- **WARNING** - Warning messages for potential issues
- **ERROR** - Error messages for failed operations

## Key Logging Areas

### 1. Service Startup
- Environment configuration
- API key availability
- Database connection status
- Data source initialization
- Scheduler setup

### 2. Database Operations
- Connection pool creation
- Query execution details
- Parameter values
- Success/failure status
- Error details with context

### 3. Data Source Operations
- API request details
- Rate limiting status
- Response parsing
- Error handling
- Health check results

### 4. Ingestion Process
- Symbol processing status
- Cache hit/miss information
- Data source selection
- Price data details
- Storage success/failure

### 5. Scheduling
- Market hours detection
- Task execution timing
- Error handling in scheduled tasks

## Emoji Indicators

The logging system uses emojis to quickly identify different types of operations:

- 🚀 **Starting operations**
- ✅ **Successful operations**
- ❌ **Failed operations**
- ⚠️ **Warnings**
- 🔍 **Debugging information**
- 📊 **Data/statistics**
- 🔧 **Configuration/setup**
- 📡 **Network operations**
- 💾 **Database operations**
- ⏰ **Timing information**
- 🧪 **Testing/health checks**

## Debugging Database Issues

### Check Database Connection
Look for these log messages:
```
🔌 Initializing database connection pool...
📡 Database URL: localhost:5432
✅ Database connection pool initialized successfully
```

### Check Database Operations
Look for these log messages:
```
💾 Attempting to store price data for AAPL
📊 Price data details: Open=$150.25, Close=$151.50, Volume=1000000, Date=2024-01-15
🔌 Acquired database connection for AAPL
🔧 Ensuring instrument exists for AAPL...
✅ Instrument ensured for AAPL
📝 Executing upsert query for AAPL...
✅ Successfully executed upsert for AAPL: INSERT 0 1
✅ Successfully stored price data for AAPL in database
```

### Check Data Source Issues
Look for these log messages:
```
🎯 Trying alpha_vantage for AAPL
📡 Fetching AAPL from Alpha Vantage
🔗 Alpha Vantage request URL: https://www.alphavantage.co/query
📋 Alpha Vantage request params: function=GLOBAL_QUOTE, symbol=AAPL
📡 Alpha Vantage response status: 200
📊 Alpha Vantage response received: 1234 characters
✅ Successfully fetched AAPL from Alpha Vantage: $151.50
```

## Common Issues and Log Messages

### 1. Database Connection Failed
```
❌ Failed to initialize database: ConnectionError: connection refused
🔍 Database initialization error details: connection refused
```

### 2. API Rate Limiting
```
⏳ Alpha Vantage rate limited for AAPL, skipping
⚠️  Alpha Vantage API rate limit reached: Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day.
```

### 3. Missing API Keys
```
⚠️  Finnhub API key not configured
⚠️  Alpha Vantage API key not configured
```

### 4. Data Source Failures
```
❌ Alpha Vantage failed for AAPL: API error: Invalid API call
⚠️  All data sources failed for AAPL
```

### 5. Database Storage Failures
```
❌ Failed to store price data for AAPL: DatabaseError: relation "daily_prices" does not exist
🔍 Database error details: relation "daily_prices" does not exist
💡 Error hint: No function matches the given name and argument types
📍 Error location: line 1 of function exec_simple
```

## Testing the Logging

Run the test script to verify logging is working:

```bash
cd services/price-ingestion
python test_logging.py
```

This will test all logging levels and components.

## Configuration

### Log Level
Set the log level using the `LOG_LEVEL` environment variable:
```bash
export LOG_LEVEL=DEBUG  # Most verbose
export LOG_LEVEL=INFO   # Default
export LOG_LEVEL=WARNING # Only warnings and errors
export LOG_LEVEL=ERROR  # Only errors
```

### Log Format
Set the log format using the `LOG_FORMAT` environment variable:
```bash
export LOG_FORMAT=json      # JSON format for production
export LOG_FORMAT=text      # Human-readable format for development
```

## Troubleshooting

### 1. No Logs Appearing
- Check if the `logs/` directory exists
- Verify file permissions
- Check environment variables

### 2. Too Many Logs
- Increase log level to WARNING or ERROR
- Check for DEBUG level logging in production

### 3. Missing Specific Information
- Ensure log level is set to DEBUG
- Check if the specific component is being logged
- Verify the logging calls are in place

## Next Steps

With the enhanced logging in place, you should now be able to:

1. **Identify database connection issues** - Look for connection errors in the logs
2. **Track data source failures** - See which APIs are failing and why
3. **Monitor the ingestion process** - Follow each symbol through the entire pipeline
4. **Debug storage issues** - See exactly what's happening during database operations
5. **Monitor scheduling** - Understand when and why tasks are running

Run the service and check the logs to identify the specific issue preventing price insertion into the database.
