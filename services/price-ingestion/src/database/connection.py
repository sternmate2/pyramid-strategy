"""
Database connection and management utilities.
"""

import asyncio
import asyncpg
import json
import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from .models import PriceData, StockInstrument
from ..utils.config import config
from ..utils.logger import logger
from ..exceptions import DatabaseError


class DatabaseManager:
    """
    Manages PostgreSQL database connections and operations.
    """
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.stats = {
            'queries_executed': 0,
            'successful_queries': 0,
            'failed_queries': 0,
            'last_query_time': None
        }
        logger.info("DatabaseManager initialized")
    
    async def initialize(self):
        """Initialize database connection pool."""
        try:
            logger.info("🔌 Initializing database connection pool...")
            logger.info(f"📡 Database URL: {config.DATABASE_URL.split('@')[1] if '@' in config.DATABASE_URL else 'localhost'}")
            
            # Create connection pool
            logger.debug("🔧 Creating connection pool...")
            self.pool = await asyncpg.create_pool(
                config.DATABASE_URL,
                min_size=2,
                max_size=10,
                command_timeout=60,
                server_settings={
                    'jit': 'off'  # Disable JIT for better compatibility
                }
            )
            logger.info(f"✅ Connection pool created with size: {self.pool.get_size()}")
            
            # Test connection
            logger.debug("🧪 Testing database connection...")
            async with self.pool.acquire() as conn:
                test_result = await conn.fetchval('SELECT 1')
                logger.info(f"✅ Database connection test successful: {test_result}")
            
            logger.info("✅ Database connection pool initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize database: {type(e).__name__}: {e}")
            logger.error(f"🔍 Database initialization error details: {str(e)}")
            raise DatabaseError(f"Database initialization failed: {e}")
    
    async def store_price(self, price_data: PriceData, interval_minutes: int = None) -> bool:
        """
        Store price data in the database.
        
        Args:
            price_data: PriceData object to store
            interval_minutes: If provided, store as intraday data with this interval
            
        Returns:
            True if successful, False otherwise
        """
        logger.debug(f"💾 Attempting to store price data for {price_data.symbol}")
        logger.debug(f"📊 Price data details: Open=${price_data.open_price}, Close=${price_data.close_price}, Volume={price_data.volume}, Date={price_data.timestamp.date()}")
        
        try:
            if not self.pool:
                logger.error("❌ Database pool not initialized")
                return False
            
            async with self.pool.acquire() as conn:
                logger.debug(f"🔌 Acquired database connection for {price_data.symbol}")
                
                # First, ensure the instrument exists
                logger.debug(f"🔧 Ensuring instrument exists for {price_data.symbol}...")
                await self._ensure_instrument_exists(conn, price_data.symbol)
                logger.debug(f"✅ Instrument ensured for {price_data.symbol}")
                
                # Check if this is a cryptocurrency symbol
                is_crypto = self._is_crypto_symbol(price_data.symbol)
                logger.info(f"🔍 Symbol {price_data.symbol} is {'cryptocurrency' if is_crypto else 'stock'}")
                
                # Store intraday data if interval is specified
                if interval_minutes and not is_crypto:
                    await self._store_intraday_price(conn, price_data, interval_minutes)
                elif is_crypto:
                    # Store in crypto_prices table
                    await self._store_crypto_price(conn, price_data)
                else:
                    # Store in daily_prices table
                    await self._store_stock_price(conn, price_data)
                
                self._update_stats(success=True)
                logger.info(f"✅ Successfully stored price data for {price_data.symbol} in database")
                return True
                
        except Exception as e:
            self._update_stats(success=False)
            logger.error(f"❌ Failed to store price data for {price_data.symbol}: {type(e).__name__}: {e}")
            logger.error(f"🔍 Database error details for {price_data.symbol}: {str(e)}")
            
            # Log additional context for debugging
            if hasattr(e, 'detail'):
                logger.error(f"🔍 Error detail: {e.detail}")
            if hasattr(e, 'hint'):
                logger.error(f"💡 Error hint: {e.hint}")
            if hasattr(e, 'where'):
                logger.error(f"📍 Error location: {e.where}")
            
            return False
    
    def _is_crypto_symbol(self, symbol: str) -> bool:
        """Check if a symbol is a cryptocurrency."""
        # Check for common cryptocurrency symbols
        crypto_symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'LTC', 'BCH', 'XRP', 'XLM', 'EOS']
        
        # Check for slash notation (e.g., BTC/USD)
        if '/' in symbol:
            base = symbol.split('/')[0].upper()
            return base in crypto_symbols
        
        # Check for dash notation (e.g., BTC-USD)
        if '-' in symbol:
            base = symbol.split('-')[0].upper()
            return base in crypto_symbols
        
        # Check if the symbol itself is a known crypto
        clean_symbol = symbol.upper().replace('USD', '').replace('USDT', '')
        return clean_symbol in crypto_symbols
    
    async def _store_crypto_price(self, conn, price_data: PriceData):
        """Store cryptocurrency price data in crypto_prices table."""
        logger.debug(f"💾 Storing crypto price for {price_data.symbol} in crypto_prices table")
        
        try:
            # Extract crypto-specific data from metadata
            metadata = price_data.metadata or {}
            price_change_24h = metadata.get('price_change_24h')
            price_change_percent_24h = metadata.get('price_change_percent_24h')
            market_cap_usd = metadata.get('market_cap_usd')
            
            query = """
            INSERT INTO crypto_prices (
                symbol, timestamp, market_timestamp, price_usd, closing_price_usd, volume_24h, market_cap_usd,
                price_change_24h, price_change_percent_24h, source, metadata, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
            ON CONFLICT (symbol, market_timestamp) 
            DO UPDATE SET
                price_usd = EXCLUDED.price_usd,
                closing_price_usd = EXCLUDED.closing_price_usd,
                volume_24h = EXCLUDED.volume_24h,
                market_cap_usd = EXCLUDED.market_cap_usd,
                price_change_24h = EXCLUDED.price_change_24h,
                price_change_percent_24h = EXCLUDED.price_change_percent_24h,
                source = EXCLUDED.source,
                metadata = EXCLUDED.metadata,
                created_at = EXCLUDED.created_at
            """
            
            # Convert metadata to JSON string if it's a dict
            metadata_json = json.dumps(price_data.metadata) if price_data.metadata else '{}'
            
            params = [
                price_data.symbol,
                price_data.timestamp,  # Keep original timestamp for backward compatibility
                price_data.timestamp,  # Use the same timestamp as market_timestamp (it's already the market time)
                price_data.close_price,  # Use close_price as price_usd for crypto
                price_data.close_price,  # Use close_price as closing_price_usd for crypto
                price_data.volume,
                market_cap_usd,
                price_change_24h,
                price_change_percent_24h,
                getattr(price_data, 'source', 'coingecko'),  # Default to coingecko if no source
                metadata_json,
                datetime.now()
            ]
            
            logger.debug(f"📝 Executing crypto price insert for {price_data.symbol}...")
            result = await conn.execute(query, *params)
            logger.info(f"✅ Successfully stored crypto price for {price_data.symbol}: {result}")
            
            # Invalidate cache for this symbol after successful storage
            await self._invalidate_symbol_cache(price_data.symbol)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to store crypto price for {price_data.symbol}: {type(e).__name__}: {e}")
            return False
    
    async def _store_intraday_price(self, conn, price_data: PriceData, interval_minutes: int):
        """Store intraday price data in intraday_prices table."""
        logger.debug(f"💾 Storing intraday price for {price_data.symbol} with {interval_minutes}min interval")
        
        try:
            query = """
            INSERT INTO intraday_prices (
                symbol, timestamp, open, high, low, close, volume, interval_minutes,
                source, metadata, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
            ON CONFLICT (symbol, timestamp, interval_minutes) 
            DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                volume = EXCLUDED.volume,
                source = EXCLUDED.source,
                metadata = EXCLUDED.metadata,
                created_at = EXCLUDED.created_at
            """
            
            # Convert metadata to JSON string if it's a dict
            metadata_json = json.dumps(price_data.metadata) if price_data.metadata else '{}'
            
            params = [
                price_data.symbol,
                price_data.timestamp,  # Use the exact timestamp for intraday data
                price_data.open_price,
                price_data.high_price,
                price_data.low_price,
                price_data.close_price,
                price_data.volume,
                interval_minutes,
                getattr(price_data, 'source', 'finnhub'),
                metadata_json,
                datetime.now()
            ]
            
            logger.debug(f"📝 Executing intraday price insert for {price_data.symbol}...")
            result = await conn.execute(query, *params)
            logger.info(f"✅ Successfully stored intraday price for {price_data.symbol} ({interval_minutes}min): {result}")
            
            # Invalidate cache for this symbol after successful storage
            await self._invalidate_symbol_cache(price_data.symbol)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to store intraday price for {price_data.symbol}: {e}")
            return False
    
    async def _store_stock_price(self, conn, price_data: PriceData):
        """Store stock price data in daily_prices table."""
        logger.debug(f"💾 Storing stock price for {price_data.symbol} in daily_prices table")
        
        try:
            query = """
            INSERT INTO daily_prices (
                symbol, date, market_timestamp, open, high, low, close, closing_price, volume, 
                source, metadata, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $11
            )
            ON CONFLICT (symbol, market_timestamp) 
            DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                closing_price = EXCLUDED.closing_price,
                volume = EXCLUDED.volume,
                source = EXCLUDED.source,
                metadata = EXCLUDED.metadata,
                updated_at = EXCLUDED.updated_at
            """
            
            # Convert metadata to JSON string if it's a dict
            metadata_json = json.dumps(price_data.metadata) if price_data.metadata else '{}'
            
            params = [
                price_data.symbol,
                price_data.timestamp.date(),  # Keep the date for backward compatibility
                price_data.timestamp,  # Store the full market timestamp
                price_data.open_price,
                price_data.high_price,
                price_data.low_price,
                price_data.close_price,
                price_data.volume,
                getattr(price_data, 'source', 'finnhub'),  # Default to finnhub if no source
                metadata_json,
                datetime.now()
            ]
            
            logger.debug(f"📝 Executing stock price insert for {price_data.symbol}...")
            result = await conn.execute(query, *params)
            logger.info(f"✅ Successfully stored stock price for {price_data.symbol}: {result}")
            
            # Invalidate cache for this symbol after successful storage
            await self._invalidate_symbol_cache(price_data.symbol)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to store stock price for {price_data.symbol}: {type(e).__name__}: {e}")
            return False
    
    async def store_historical_prices(self, symbol: str, price_data_list: List[PriceData]) -> Dict[str, Any]:
        """
        Store multiple historical price records for a symbol.
        
        Args:
            symbol: Stock/crypto symbol
            price_data_list: List of PriceData objects
            
        Returns:
            Dictionary with results: {'success': bool, 'stored': int, 'skipped': int, 'errors': int}
        """
        logger.info(f"💾 Storing {len(price_data_list)} historical prices for {symbol}")
        
        if not self.pool:
            logger.error("❌ Database pool not initialized")
            return {'success': False, 'stored': 0, 'skipped': 0, 'errors': 0, 'error': 'Database not initialized'}
        
        if not price_data_list:
            logger.warning(f"⚠️  No price data provided for {symbol}")
            return {'success': True, 'stored': 0, 'skipped': 0, 'errors': 0}
        
        results = {'stored': 0, 'skipped': 0, 'errors': 0}
        
        try:
            async with self.pool.acquire() as conn:
                # Ensure instrument exists
                await self._ensure_instrument_exists(conn, symbol)
                
                # Use a transaction for bulk insert
                async with conn.transaction():
                    for i, price_data in enumerate(price_data_list):
                        try:
                            # Validate price data
                            if not self._validate_price_data(price_data):
                                logger.warning(f"⚠️  Skipping invalid price data for {symbol} at index {i}")
                                results['skipped'] += 1
                                continue
                            
                            # Store the price
                            success = await self._store_stock_price(conn, price_data)
                            if success:
                                results['stored'] += 1
                                if (i + 1) % 100 == 0:  # Log progress every 100 records
                                    logger.debug(f"📊 Progress: {i + 1}/{len(price_data_list)} prices stored for {symbol}")
                            else:
                                results['errors'] += 1
                                
                        except Exception as e:
                            logger.error(f"❌ Error storing price {i} for {symbol}: {type(e).__name__}: {e}")
                            results['errors'] += 1
                            continue
                
                logger.info(f"✅ Historical prices stored for {symbol}: {results['stored']} stored, {results['skipped']} skipped, {results['errors']} errors")
                return {'success': True, **results}
                
        except Exception as e:
            logger.error(f"❌ Failed to store historical prices for {symbol}: {type(e).__name__}: {e}")
            return {'success': False, 'stored': results['stored'], 'skipped': results['skipped'], 'errors': results['errors'], 'error': str(e)}
    
    async def _invalidate_symbol_cache(self, symbol: str):
        """Invalidate cache for a specific symbol after data changes."""
        try:
            # Import here to avoid circular imports
            import redis
            import asyncio
            
            # Get Redis configuration from environment
            redis_host = os.getenv('REDIS_HOST', 'localhost')
            redis_port = int(os.getenv('REDIS_PORT', 6379))
            redis_password = os.getenv('REDIS_PASSWORD', 'redis_secure_password')
            
            # Create Redis client
            redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                decode_responses=True
            )
            
            # Clear all cache entries related to this symbol
            patterns = [
                f"price:{symbol.upper()}:*",           # Current prices
                f"historical:{symbol.upper()}:*",      # Historical data
                f"crypto:{symbol.upper()}:*"          # Crypto data
            ]
            
            total_cleared = 0
            for pattern in patterns:
                keys = redis_client.keys(pattern)
                if keys:
                    redis_client.delete(*keys)
                    total_cleared += len(keys)
                    logger.debug(f"🧹 Cleared {len(keys)} cache entries for pattern: {pattern}")
            
            if total_cleared > 0:
                logger.info(f"🧹 Cache invalidated for symbol: {symbol}, cleared {total_cleared} entries")
            
            redis_client.close()
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to invalidate cache for {symbol}: {type(e).__name__}: {e}")
            # Don't fail the main operation if cache invalidation fails
    
    def _validate_price_data(self, price_data: PriceData) -> bool:
        """
        Validate price data before storage.
        
        Args:
            price_data: PriceData object to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            # Check required fields
            if not price_data.symbol or not price_data.timestamp:
                return False
            
            # Check price values are reasonable
            if price_data.close_price and price_data.close_price <= 0:
                return False
            
            if price_data.open_price and price_data.open_price <= 0:
                return False
            
            if price_data.high_price and price_data.high_price <= 0:
                return False
            
            if price_data.low_price and price_data.low_price <= 0:
                return False
            
            # Check that high >= low
            if price_data.high_price and price_data.low_price and price_data.high_price < price_data.low_price:
                return False
            
            # Check timestamp is reasonable (not too far in future or past)
            now = datetime.now()
            if price_data.timestamp > now + timedelta(days=1):  # Allow 1 day in future for timezone differences
                return False
            
            if price_data.timestamp < now - timedelta(days=365*5):  # Not more than 5 years in past
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"⚠️  Price data validation error: {e}")
            return False
    
    def get_historical_data_limits(self, symbol: str) -> Dict[str, Any]:
        """
        Get the maximum historical data limits for a symbol based on API constraints.
        
        Args:
            symbol: Stock/crypto symbol
            
        Returns:
            Dictionary with limits: {'max_days': int, 'max_records': int, 'api_limits': Dict}
        """
        is_crypto = self._is_crypto_symbol(symbol)
        
        if is_crypto:
            # CoinGecko: Free tier allows up to 90 days of historical data
            return {
                'max_days': 90,
                'max_records': 90,
                'api_limits': {
                    'coingecko': {'max_days': 90, 'rate_limit': '50 calls/minute'}
                }
            }
        else:
            # Stock APIs: Conservative limits to avoid rate limiting
            return {
                'max_days': 90,  # 3 months max
                'max_records': 90,
                'api_limits': {
                    'finnhub': {'max_days': 90, 'rate_limit': '58 calls/minute'},
                    'yahoo': {'max_days': 90, 'rate_limit': '30 calls/minute'},
                    'alpha_vantage': {'max_days': 90, 'rate_limit': '1 calls/minute'}
                }
            }
    
    async def get_latest_price(self, symbol: str) -> Optional[PriceData]:
        """
        Get the latest price data for a symbol.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            PriceData object if found, None otherwise
        """
        logger.debug(f"🔍 Fetching latest price for {symbol}")
        
        try:
            if not self.pool:
                logger.error("❌ Database pool not initialized")
                return None
            
            async with self.pool.acquire() as conn:
                logger.debug(f"🔌 Acquired database connection for {symbol} query")
                
                query = """
                SELECT symbol, date, market_timestamp, open, high, low, close, volume, 
                       source, metadata, created_at
                FROM daily_prices 
                WHERE symbol = $1 
                ORDER BY market_timestamp DESC, created_at DESC 
                LIMIT 1
                """
                
                logger.debug(f"📝 Executing query for {symbol}: {query}")
                
                row = await conn.fetchrow(query, symbol.upper())
                
                if row:
                    logger.debug(f"✅ Found latest price for {symbol}: Close=${row['close']}, Date={row['date']}")
                    return PriceData(
                        symbol=row['symbol'],
                        open_price=row['open'],
                        high_price=row['high'],
                        low_price=row['low'],
                        close_price=row['close'],
                        volume=row['volume'],
                        timestamp=row['market_timestamp'],  # Use the actual market timestamp
                        source=row['source'],
                        metadata=row['metadata']
                    )
                else:
                    logger.debug(f"⚠️  No price data found for {symbol}")
                    return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get latest price for {symbol}: {type(e).__name__}: {e}")
            return None
    
    async def get_historical_prices(self, symbol: str, days: int = 30) -> List[PriceData]:
        """
        Get historical price data for a symbol.
        
        Args:
            symbol: Stock symbol
            days: Number of days of historical data
            
        Returns:
            List of PriceData objects
        """
        logger.debug(f"📚 Fetching {days} days of historical prices for {symbol}")
        
        try:
            if not self.pool:
                logger.error("❌ Database pool not initialized")
                return []
            
            async with self.pool.acquire() as conn:
                logger.debug(f"🔌 Acquired database connection for {symbol} historical query")
                
                query = """
                SELECT symbol, date, market_timestamp, open, high, low, close, volume, 
                       source, metadata, created_at
                FROM daily_prices 
                WHERE symbol = $1 AND market_timestamp >= CURRENT_TIMESTAMP - INTERVAL '%s days'
                ORDER BY market_timestamp ASC
                """ % days
                
                logger.debug(f"📝 Executing historical query for {symbol}: {query}")
                
                rows = await conn.fetch(query, symbol.upper())
                logger.info(f"📊 Retrieved {len(rows)} historical price records for {symbol}")
                
                historical_data = []
                for i, row in enumerate(rows):
                    try:
                        price_data = PriceData(
                            symbol=row['symbol'],
                            open_price=row['open'],
                            high_price=row['high'],
                            low_price=row['low'],
                            close_price=row['close'],
                            volume=row['volume'],
                            timestamp=row['market_timestamp'],  # Use the actual market timestamp
                            source=row['source'],
                            metadata=row['metadata']
                        )
                        historical_data.append(price_data)
                        logger.debug(f"✅ Parsed historical record {i+1}/{len(rows)} for {symbol}")
                    except Exception as e:
                        logger.warning(f"⚠️  Failed to parse historical record {i+1} for {symbol}: {e}")
                        continue
                
                logger.info(f"✅ Successfully retrieved {len(historical_data)} historical prices for {symbol}")
                return historical_data
                
        except Exception as e:
            logger.error(f"❌ Failed to get historical prices for {symbol}: {type(e).__name__}: {e}")
            return []
    
    async def _ensure_instrument_exists(self, conn, symbol: str):
        """Ensure the instrument exists in the instruments table."""
        logger.debug(f"🔧 Ensuring instrument exists for {symbol}")
        
        try:
            # Check if this is a cryptocurrency symbol
            is_crypto = self._is_crypto_symbol(symbol)
            instrument_type = 'CRYPTO' if is_crypto else 'STOCK'
            is_24h_trading = is_crypto  # Cryptocurrencies trade 24/7
            
            logger.debug(f"🔍 Instrument {symbol} type: {instrument_type}, 24h trading: {is_24h_trading}")
            
            query = """
            INSERT INTO instruments (
                symbol, name, instrument_type, is_24h_trading, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $5
            )
            ON CONFLICT (symbol) DO UPDATE SET 
                instrument_type = EXCLUDED.instrument_type,
                is_24h_trading = EXCLUDED.is_24h_trading,
                updated_at = EXCLUDED.updated_at
            """
            
            result = await conn.execute(query, symbol.upper(), symbol.upper(), instrument_type, is_24h_trading, datetime.now())
            logger.debug(f"✅ Instrument ensured for {symbol}: {result}")
            
        except Exception as e:
            logger.error(f"❌ Failed to ensure instrument exists for {symbol}: {type(e).__name__}: {e}")
            raise
    
    def _update_stats(self, success: bool):
        """Update internal statistics."""
        self.stats['queries_executed'] += 1
        self.stats['last_query_time'] = datetime.now().isoformat()
        
        if success:
            self.stats['successful_queries'] += 1
            logger.debug(f"📊 Stats updated: successful query (total: {self.stats['successful_queries']})")
        else:
            self.stats['failed_queries'] += 1
            logger.debug(f"📊 Stats updated: failed query (total: {self.stats['failed_queries']})")
    
    async def needs_historical_population(self, symbol: str, min_days: int = 90) -> bool:
        """
        Check if a symbol needs historical data population.
        
        Args:
            symbol: Stock/crypto symbol
            min_days: Minimum days of data required (default: 90 days = 3 months)
            
        Returns:
            True if historical population is needed, False otherwise
        """
        logger.debug(f"🔍 Checking if {symbol} needs historical data population (min: {min_days} days)")
        
        if not self.pool:
            logger.error("❌ Database pool not initialized")
            return True  # Assume we need data if DB is not available
        
        try:
            async with self.pool.acquire() as conn:
                # Check if we have enough recent data
                query = """
                SELECT COUNT(*) as count, 
                       MIN(market_timestamp) as earliest_date,
                       MAX(market_timestamp) as latest_date
                FROM daily_prices 
                WHERE symbol = $1
                """
                
                row = await conn.fetchrow(query, symbol.upper())
                
                if not row or row['count'] == 0:
                    logger.info(f"📊 {symbol}: No historical data found, needs population")
                    return True
                
                count = row['count']
                earliest_date = row['earliest_date']
                latest_date = row['latest_date']
                
                # Calculate days of data coverage
                if earliest_date and latest_date:
                    days_covered = (latest_date - earliest_date).days
                    logger.debug(f"📊 {symbol}: Found {count} records covering {days_covered} days")
                    
                    # Check if we have enough data and it's recent enough
                    # Make datetime timezone-aware for comparison
                    import pytz
                    now_utc = datetime.now(pytz.UTC)
                    cutoff_date = now_utc - timedelta(days=7)
                    
                    if days_covered >= min_days and latest_date >= cutoff_date:
                        logger.info(f"✅ {symbol}: Sufficient historical data available ({days_covered} days, latest: {latest_date.date()})")
                        return False
                    else:
                        logger.info(f"📊 {symbol}: Insufficient or outdated data ({days_covered} days, latest: {latest_date.date()}), needs population")
                        return True
                else:
                    logger.warning(f"⚠️  {symbol}: Invalid date range in database, needs population")
                    return True
                    
        except Exception as e:
            logger.error(f"❌ Failed to check historical data needs for {symbol}: {type(e).__name__}: {e}")
            return True  # Assume we need data if there's an error
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        logger.debug("📊 Retrieving database statistics...")
        
        if not self.pool:
            logger.warning("⚠️  Database pool not available for stats")
            return {'status': 'disconnected'}
        
        try:
            async with self.pool.acquire() as conn:
                logger.debug("🔌 Acquired connection for stats query")
                
                # Get table row counts
                instruments_count = await conn.fetchval('SELECT COUNT(*) FROM instruments')
                stock_prices_count = await conn.fetchval('SELECT COUNT(*) FROM daily_prices')
                crypto_prices_count = await conn.fetchval('SELECT COUNT(*) FROM crypto_prices')
                
                stats = {
                    'status': 'connected',
                    'pool_size': self.pool.get_size(),
                    'instruments_count': instruments_count,
                    'stock_prices_count': stock_prices_count,
                    'crypto_prices_count': crypto_prices_count,
                    **self.stats
                }
                
                logger.debug(f"📊 Database stats: {stats}")
                return stats
                
        except Exception as e:
            logger.error(f"❌ Failed to get database stats: {type(e).__name__}: {e}")
            return {
                'status': 'error',
                'error': str(e),
                **self.stats
            }
    
    async def close(self):
        """Close database connection pool."""
        if self.pool:
            logger.info("🔄 Closing database connection pool...")
            await self.pool.close()
            self.pool = None
            logger.info("✅ Database connection pool closed")
        else:
            logger.debug("⚠️  Database pool already closed or not initialized")