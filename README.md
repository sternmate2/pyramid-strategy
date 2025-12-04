# Stock Anomaly Detection System

A cloud-native, microservices-based stock price ingestion and API system built for detecting market anomalies. This system provides real-time stock price data through a robust, multi-source architecture.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Data Sources  │    │   Ingestion      │    │   API Service   │
│                 │    │   (Python)       │    │   (Node.js)     │
│ • Finnhub API   ├───►│ • yfinance       ├───►│ • Express.js    │
│ • Yahoo Finance │    │ • Multi-source   │    │ • Redis Cache   │
│ • Alpha Vantage │    │ • Fallback Logic │    │ • REST API      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                ▼
                       ┌──────────────────┐
                       │   Data Storage   │
                       │                  │
                       │ • PostgreSQL     │
                       │ • Redis Cache    │
                       └──────────────────┘
```

## 🚀 Features

- **Multi-source data ingestion** with intelligent fallback
- **Real-time price updates** (15-minute intervals during market hours)
- **RESTful API** with caching for fast responses
- **Docker containerization** for easy deployment
- **Horizontal scalability** ready architecture
- **Rate limiting** and error handling
- **Comprehensive logging** and monitoring

## 📊 Data Sources

| Source | Rate Limit | Reliability | Usage |
|--------|------------|-------------|--------|
| **Finnhub** | 60/min | ⭐⭐⭐⭐⭐ | Primary real-time data |
| **Yahoo Finance** | ~1000/hour | ⭐⭐⭐ | Secondary/backup via yfinance |
| **Alpha Vantage** | 25/day | ⭐⭐⭐⭐ | Historical data |

## 🛠️ Tech Stack

### Services
- **Price Ingestion**: Python 3.11, yfinance, requests, pandas
- **Price API**: Node.js 18, Express.js, Redis, PostgreSQL
- **Database**: PostgreSQL 15, Redis 7
- **Load Balancer**: Nginx
- **Containerization**: Docker & Docker Compose

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose installed
- At least 4GB RAM available
- Internet connection for API access

### 1. Clone Repository
```bash
git clone https://github.com/your-username/stock-anomaly-system.git
cd stock-anomaly-system
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### 3. Start Services
```bash
# Start all services
make up

# Or manually with docker-compose
docker-compose up -d
```

### 4. Verify Installation
```bash
# Check service health
make health-check

# View logs
make logs
```

### 5. Access Services
- **API Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health
- **Grafana Dashboard**: http://localhost:3001 (admin/admin)

## 📝 Environment Variables

```bash
# API Keys (required)
FINNHUB_API_KEY=your_finnhub_key_here
ALPHAVANTAGE_API_KEY=your_alpha_vantage_key_here

# Database Configuration
POSTGRES_DB=stock_anomaly
POSTGRES_USER=stockuser
POSTGRES_PASSWORD=securepassword123
DATABASE_URL=postgresql://stockuser:securepassword123@postgres:5432/stock_anomaly

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_secure_password

# Application Configuration
NODE_ENV=development
API_PORT=3000
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

## 🔧 Development

### Local Development Setup
```bash
# Install development dependencies
make install-dev

# Run tests
make test

# Lint code
make lint

# Format code
make format
```

### Adding New Data Sources
1. Create new source class in `services/price-ingestion/src/data_sources/`
2. Inherit from `BaseDataSource`
3. Implement required methods
4. Add to ingestion configuration

### API Development
```bash
# Start only API service for development
docker-compose up -d postgres redis
cd services/price-api
npm install
npm run dev
```

## 📖 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Endpoints

#### Get Latest Price
```http
GET /api/v1/price/{symbol}
```

**Example Response:**
```json
{
  "symbol": "SPY",
  "price": {
    "open": 445.20,
    "high": 448.75,
    "low": 444.10,
    "close": 447.50,
    "volume": 52847392,
    "date": "2024-08-30"
  },
  "timestamp": "2024-08-30T16:00:00Z",
  "source": "cache"
}
```

#### Get Historical Prices
```http
GET /api/v1/price/{symbol}/history?days=30
```

#### Health Check
```http
GET /health
```

For complete API documentation, see [docs/API.md](docs/API.md)

## 🚢 Deployment

### Production Deployment
```bash
# Build production images
make build-prod

# Deploy to production
make deploy-prod

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale price-api=3
```

### Cloud Deployment (DigitalOcean)
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed cloud deployment instructions.

## 📊 Monitoring

### Metrics & Logging
- **Application Logs**: Structured JSON logging
- **Metrics**: Prometheus metrics exposed
- **Dashboards**: Grafana dashboards included
- **Health Checks**: Built-in health endpoints

### Performance Monitoring
```bash
# View real-time metrics
docker-compose logs -f price-ingestion
docker-compose logs -f price-api

# Access Grafana dashboard
open http://localhost:3001
```

## 🧪 Testing

### Run All Tests
```bash
make test
```

### Individual Service Tests
```bash
# Test price ingestion
cd services/price-ingestion
python -m pytest tests/

# Test price API
cd services/price-api
npm test
```

### Load Testing
```bash
# Install k6
brew install k6  # macOS
# or apt-get install k6  # Ubuntu

# Run load tests
k6 run tests/load/api-load-test.js
```

## 🔒 Security

- API key management via environment variables
- Rate limiting on all endpoints
- CORS protection
- Input validation and sanitization
- SQL injection protection
- Docker security best practices

## 🐛 Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check Docker daemon
docker info

# Check logs
docker-compose logs [service-name]

# Restart services
make restart
```

**API errors:**
```bash
# Check API logs
docker-compose logs price-api

# Verify database connection
make db-check
```

**Data ingestion issues:**
```bash
# Check ingestion logs
docker-compose logs price-ingestion

# Verify API keys
make verify-api-keys
```

For detailed troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## 🗄️ Database Querying Guide

### Overview
The system uses PostgreSQL for storing price data and Redis for caching. This guide shows you how to query the database to check data status, troubleshoot issues, and monitor system health.

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `daily_prices` | Daily stock price data | `symbol`, `date`, `open`, `high`, `low`, `close`, `volume`, `source` |
| `instruments` | Stock symbols and metadata | `symbol`, `name`, `created_at`, `updated_at` |
| `intraday_prices` | Intraday price data | `symbol`, `timestamp`, `price`, `volume` |
| `api_usage` | API call tracking | `endpoint`, `method`, `status_code`, `response_time`, `created_at` |

### Connecting with pgAdmin

1. **Open pgAdmin** and connect to your PostgreSQL server
2. **Navigate to your database** (e.g., `stock_anomaly`)
3. **Expand the database** and look for the `public` schema
4. **Use the Query Tool** to run SQL commands

### Essential Database Queries

#### 1. Check Database Status
```sql
-- Complete database status overview
SELECT 
    'Daily Prices' as table_name,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'Empty - needs historical data'
        ELSE 'Has data'
    END as status
FROM daily_prices
UNION ALL
SELECT 
    'Instruments' as table_name,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'Empty - needs symbols'
        ELSE 'Has instruments'
    END as status
FROM instruments
UNION ALL
SELECT 
    'Recent Data (7 days)' as table_name,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'No recent data - needs startup population'
        ELSE 'Has recent data'
    END as status
FROM daily_prices 
WHERE date >= CURRENT_DATE - INTERVAL '7 days';
```

#### 2. Check Current Price Data
```sql
-- Total price records
SELECT COUNT(*) as total_price_records FROM daily_prices;

-- Data by symbol
SELECT 
    symbol,
    COUNT(*) as record_count,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM daily_prices 
GROUP BY symbol 
ORDER BY symbol;

-- Most recent prices
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
ORDER BY date DESC, symbol 
LIMIT 20;
```

#### 3. Check for Recent Data (Last 7 Days)
```sql
-- Recent data summary
SELECT 
    symbol,
    COUNT(*) as recent_records,
    MIN(date) as earliest_recent,
    MAX(date) as latest_recent
FROM daily_prices 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY symbol 
ORDER BY symbol;
```

### Advanced Price Investigation Queries

For comprehensive price analysis and debugging, use the queries in `database/queries/check-prices.sql`. These queries will help identify:

- **Data Statistics**: Overall record counts and date ranges
- **Price Anomalies**: Extreme or suspicious price values  
- **Data Consistency**: Duplicates, missing values, and statistical outliers
- **Recent Issues**: Data insertion problems and timing discrepancies
- **Source Analysis**: Which data sources are providing data

#### Quick Diagnostic Queries:

```sql
-- Check for extreme price values
SELECT symbol, date, close, source 
FROM daily_prices 
WHERE close > 1000 OR close < 0.01;

-- Check BTC/USD crypto prices
SELECT symbol, timestamp, price_usd, source 
FROM crypto_prices 
WHERE symbol = 'BTC/USD' 
ORDER BY timestamp DESC 
LIMIT 10;

-- Check for data source distribution
SELECT source, COUNT(*) as record_count 
FROM daily_prices 
GROUP BY source;
```

-- Detailed recent data
SELECT 
    symbol,
    date,
    close,
    source
FROM daily_prices 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, symbol;
```

#### 4. Check Data Sources Used
```sql
-- Data source usage
SELECT 
    source,
    COUNT(*) as record_count,
    MIN(created_at) as first_used,
    MAX(created_at) as last_used
FROM daily_prices 
GROUP BY source 
ORDER BY record_count DESC;

-- Recent API usage
SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 10;
```

#### 5. Check Weekend Data
```sql
-- Check for Friday's data (useful for weekend restarts)
SELECT 
    symbol,
    date,
    close,
    source
FROM daily_prices 
WHERE date = CURRENT_DATE - INTERVAL '2 days'  -- Friday
ORDER BY symbol;
```

### Troubleshooting Queries

#### Empty Database Issues
```sql
-- Check if tables exist but are empty
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables 
WHERE schemaname = 'public';
```

#### Data Quality Issues
```sql
-- Check for missing data
SELECT 
    symbol,
    COUNT(*) as total_records,
    COUNT(CASE WHEN close IS NULL THEN 1 END) as null_closes,
    COUNT(CASE WHEN volume IS NULL THEN 1 END) as null_volumes
FROM daily_prices 
GROUP BY symbol 
HAVING COUNT(CASE WHEN close IS NULL THEN 1 END) > 0 
   OR COUNT(CASE WHEN volume IS NULL THEN 1 END) > 0;
```

#### Performance Issues
```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Expected Results for Different Scenarios

#### First-Time Startup (Empty Database)
- ✅ **Tables exist** but are empty
- ❌ **`daily_prices`**: 0 records
- ❌ **`instruments`**: 0 records
- ❌ **No recent data** from last 7 days

#### Normal Operation (Has Data)
- ✅ **`daily_prices`**: Multiple records per symbol
- ✅ **`instruments`**: Symbols defined
- ✅ **Recent data** from last 7 days
- ✅ **Multiple data sources** used

#### Weekend Restart (No Recent Data)
- ✅ **Historical data** exists
- ❌ **No data** from last 2-3 days (weekend)
- ⚠️ **May need** startup data initialization

### Monitoring Queries

#### Daily Data Ingestion Status
```sql
-- Check today's ingestion
SELECT 
    symbol,
    COUNT(*) as records_today,
    MAX(created_at) as last_ingestion
FROM daily_prices 
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY symbol 
ORDER BY symbol;
```

#### API Usage Monitoring
```sql
-- Recent API activity
SELECT 
    endpoint,
    method,
    status_code,
    COUNT(*) as call_count,
    AVG(response_time) as avg_response_time,
    MAX(created_at) as last_call
FROM api_usage 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 hour'
GROUP BY endpoint, method, status_code
ORDER BY call_count DESC;
```

### Tips for Database Queries

1. **Use LIMIT** for large result sets
2. **Index on frequently queried fields** (`symbol`, `date`, `created_at`)
3. **Monitor query performance** with `EXPLAIN ANALYZE`
4. **Use transactions** for multiple related queries
5. **Backup before** running UPDATE/DELETE operations

### Common Issues and Solutions

| Issue | Query to Check | Solution |
|-------|----------------|----------|
| **No price data** | `SELECT COUNT(*) FROM daily_prices;` | Check ingestion service logs |
| **Missing symbols** | `SELECT * FROM instruments;` | Verify symbol configuration |
| **Stale data** | Check `created_at` timestamps | Restart ingestion service |
| **API errors** | `SELECT * FROM api_usage WHERE status_code >= 400;` | Check API keys and rate limits |

For more advanced database operations, see [docs/DATABASE.md](docs/DATABASE.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -am 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-username/stock-anomaly-system/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/stock-anomaly-system/discussions)

## 🔮 Roadmap

- [ ] Real-time WebSocket streaming
- [ ] Machine learning anomaly detection
- [ ] Mobile app support
- [ ] Advanced technical indicators
- [ ] Multi-region deployment
- [ ] Kubernetes deployment manifests

---

**Built with ❤️ for the financial technology community**