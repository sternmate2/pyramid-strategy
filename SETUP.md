# Setup Guide for Docker Server Deployment

## Quick Answer: Will it work out of the box?

**Almost, but you need a few things:**

1. ✅ **Docker & Docker Compose** - Must be installed
2. ✅ **Ports 80, 443, 3003** - Must be available (or change in docker-compose.yml)
3. ⚠️ **Create `.env` file** - Copy from `.env.example` and configure
4. ⚠️ **API Keys** - Get Finnhub and Alpha Vantage API keys for price-ingestion

## Step-by-Step Setup

### 1. Clone Repository
```bash
git clone https://github.com/sternmate2/pyramid-strategy.git
cd pyramid-strategy
```

### 2. Create Environment File
```bash
cp .env.example .env
```

### 3. Edit `.env` File
**Required variables:**
```bash
# API Keys (REQUIRED for price-ingestion to work)
FINNHUB_API_KEY=your_finnhub_key_here
ALPHAVANTAGE_API_KEY=your_alpha_vantage_key_here

# Database (has defaults, but recommended to change passwords)
POSTGRES_DB=stock_anomaly
POSTGRES_USER=stockuser
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://stockuser:your_secure_password_here@postgres:5432/stock_anomaly

# Redis (has defaults)
REDIS_PASSWORD=your_redis_password_here
```

### 4. Check Port Availability
```bash
# Check if ports are in use
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :3003

# If ports are taken, edit docker-compose.yml to change them
```

### 5. Start Services
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 6. Verify Services
```bash
# Check pyramid-strategy health
curl http://localhost:3003/api/v1/pyramid-strategy/health

# Check price-api health
curl http://localhost:3000/health

# Check nginx
curl http://localhost
```

## What Services Will Start

- ✅ **PostgreSQL** - Database (internal network only)
- ✅ **Redis** - Cache (internal network only)
- ✅ **price-ingestion** - Fetches stock prices (needs API keys)
- ✅ **price-api** - REST API for prices
- ✅ **pyramid-strategy** - Pyramid trading strategy service (port 3003)
- ✅ **admin-ui** - Admin interface
- ✅ **nginx** - Reverse proxy (ports 80, 443)
- ✅ **prometheus** - Metrics (internal)
- ✅ **grafana** - Dashboards (internal)

## Network Configuration

**No special network setup needed!** Docker Compose creates its own internal network (`stock-network`). All services communicate internally.

**Only exposed ports:**
- `80` - Nginx HTTP
- `443` - Nginx HTTPS
- `3003` - Pyramid Strategy API (if you want direct access)

## Troubleshooting

### Port Already in Use
```bash
# Change ports in docker-compose.yml
# For nginx, change:
ports:
  - "8080:80"  # Instead of 80:80
  - "8443:443" # Instead of 443:443
```

### Database Connection Errors
```bash
# Check if postgres is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify DATABASE_URL in .env matches docker-compose.yml defaults
```

### Services Won't Start
```bash
# Check all logs
docker-compose logs

# Restart services
docker-compose restart

# Rebuild if code changed
docker-compose up -d --build
```

## Default Credentials

**Change these in production!**

- PostgreSQL: `stockuser` / `securepassword123`
- Redis: `redis_secure_password`
- Grafana: `admin` / `admin`

## What You DON'T Need

- ❌ External database setup
- ❌ Manual network configuration
- ❌ Firewall rules (unless you want to restrict access)
- ❌ SSL certificates (unless you want HTTPS)
- ❌ Domain names (works with IP addresses)

## Production Recommendations

1. **Change all default passwords** in `.env`
2. **Use strong passwords** for database and Redis
3. **Set up SSL/TLS** for nginx if exposing to internet
4. **Configure firewall** to restrict access
5. **Set up backups** for PostgreSQL data volume
6. **Monitor logs** regularly
7. **Update Docker images** regularly

## Summary

**Yes, it will work on your Docker server with minimal configuration:**
1. Install Docker & Docker Compose
2. Clone repo
3. Create `.env` file with API keys
4. Run `docker-compose up -d`
5. Done! 🎉

The docker-compose.yml is self-contained and creates everything needed internally.

