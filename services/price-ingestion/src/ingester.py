"""
Main price ingestion orchestrator.
Coordinates between different data sources and manages data flow.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .data_sources import DataSourceFactory
from .database.connection import DatabaseManager
from .database.models import PriceData
from .utils.cache import CacheManager
from .utils.config import config
from .utils.logger import logger
from .exceptions import IngestionError, DataSourceError


class PriceIngester:
    """
    Main price ingestion service that coordinates data collection from multiple sources.
    """
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.cache_manager = CacheManager()
        self.data_sources = DataSourceFactory.create_all()
        self.symbols = config.TRACKED_SYMBOLS
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'last_run': None,
            'sources_used': {}
        }
        logger.info(f"PriceIngester initialized with {len(self.symbols)} symbols: {self.symbols}")
        logger.info(f"Available data sources: {list(self.data_sources.keys())}")
    
    async def initialize(self):
        """Initialize all components."""
        try:
            logger.info("Initializing price ingester...")
            
            # Initialize database connection
            logger.info("Initializing database connection...")
            await self.db_manager.initialize()
            logger.info("✓ Database connection established successfully")
            
            # Initialize cache
            logger.info("Initializing cache connection...")
            await self.cache_manager.initialize()
            logger.info("✓ Cache connection established successfully")
            
            # Test data sources
            logger.info("Testing data source connectivity...")
            await self._test_data_sources()
            
            # Check and initialize startup data
            logger.info("🔍 Checking startup data requirements...")
            await self._initialize_startup_data()
            
            logger.info("✓ Price ingester initialized successfully")
            
        except Exception as e:
            logger.error(f"✗ Failed to initialize ingester: {e}")
            logger.error(f"Initialization error details: {type(e).__name__}: {str(e)}")
            raise IngestionError(f"Initialization failed: {e}")

    async def _initialize_startup_data(self):
        """
        Check if database has sufficient historical price data and populate if needed.
        This ensures the service has data to work with on first startup and for new instruments.
        """
        logger.info("🚀 Starting startup data initialization check...")
        logger.info(f"🔍 Available data sources: {list(self.data_sources.keys())}")
        logger.info(f"📊 Symbols to check: {self.symbols}")
        
        try:
            # Check each symbol individually for historical data needs
            logger.info("🔍 Step 1: Checking historical data requirements for each symbol...")
            symbols_needing_data = []
            
            for symbol in self.symbols:
                try:
                    needs_population = await self.db_manager.needs_historical_population(symbol, min_days=90)
                    if needs_population:
                        symbols_needing_data.append(symbol)
                        logger.info(f"📊 {symbol}: Needs historical data population")
                    else:
                        logger.info(f"✅ {symbol}: Sufficient historical data available")
                except Exception as e:
                    logger.warning(f"⚠️  Error checking {symbol} historical data needs: {e}")
                    symbols_needing_data.append(symbol)  # Assume it needs data if we can't check
            
            if not symbols_needing_data:
                logger.info("✅ All symbols have sufficient historical data, no population needed")
                return
            
            logger.info(f"📚 Found {len(symbols_needing_data)} symbols needing historical data population")
            logger.info(f"🎯 Symbols to populate: {symbols_needing_data}")
            
            # Populate with historical data for symbols that need it
            await self._populate_historical_data_for_symbols(symbols_needing_data)
            
            logger.info("✅ Startup data initialization completed successfully")
            
        except Exception as e:
            logger.error(f"❌ Startup data initialization failed: {type(e).__name__}: {e}")
            logger.error(f"🔍 Full error details: {str(e)}")
            import traceback
            logger.error(f"📋 Stack trace: {traceback.format_exc()}")
            logger.warning("⚠️  Continuing with service startup despite historical data failure")
    
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
    
    def _should_fetch_24h(self, symbol: str) -> bool:
        """Check if a symbol should be fetched 24/7 (cryptocurrency)."""
        return self._is_crypto_symbol(symbol)
    
    def _is_market_hours(self) -> bool:
        """
        Check if current time is during NASDAQ market hours (2:30 PM - 9:00 PM UTC).
        
        Returns:
            True if during market hours, False otherwise
        """
        try:
            import pytz
            from datetime import time
            utc_tz = pytz.timezone('UTC')
            now_utc = datetime.now(utc_tz)
            
            # Check if it's a weekday (Monday = 0, Sunday = 6)
            if now_utc.weekday() > 4:  # Saturday = 5, Sunday = 6
                return False
            
            current_time = now_utc.time()
            market_open = time(config.MARKET_OPEN_HOUR, config.MARKET_OPEN_MINUTE)
            market_close = time(config.MARKET_CLOSE_HOUR, config.MARKET_CLOSE_MINUTE)
            
            return market_open <= current_time <= market_close
            
        except Exception as e:
            logger.warning(f"Error checking market hours: {e}")
            return False
    
    def _is_source_appropriate_for_symbol(self, source_name: str, symbol: str) -> bool:
        """Check if a data source is appropriate for a given symbol type."""
        is_crypto = self._is_crypto_symbol(symbol)
        
        if is_crypto:
            # Only CoinGecko and Finnhub support crypto - Yahoo Finance does NOT support crypto symbols
            return source_name in ['coingecko', 'finnhub']
        else:
            # Exclude CoinGecko for stocks, use stock-appropriate sources
            return source_name in ['finnhub', 'yahoo', 'alpha_vantage']

    async def _check_recent_data_exists(self) -> bool:
        """
        Check if the database has recent price data (within the last 7 days).
        
        Returns:
            True if recent data exists, False otherwise
        """
        logger.debug("🔍 Checking for recent price data in database...")
        
        try:
            # Check if we have any data from the last 7 days
            for symbol in self.symbols:
                historical_data = await self.db_manager.get_historical_prices(symbol, days=7)
                if historical_data:
                    logger.info(f"✅ Found {len(historical_data)} recent price records for {symbol}")
                    return True
            
            logger.warning("⚠️  No recent price data found for any symbols")
            return False
            
        except Exception as e:
            logger.error(f"❌ Error checking recent data: {type(e).__name__}: {e}")
            return False

    async def _populate_startup_historical_data(self):
        """
        Populate the database and cache with historical data from the past week.
        Uses the most reliable data source available.
        """
        logger.info("📚 Starting historical data population for startup...")
        
        # Determine the best data source for historical data
        best_source = self._get_best_historical_source()
        if not best_source:
            logger.error("❌ No suitable data source found for historical data")
            return
        
        logger.info(f"🎯 Using {best_source.name} for historical data population")
        
        # Calculate date range (past week, excluding weekends)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        logger.info(f"📅 Fetching historical data from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
        
        total_populated = 0
        
        for symbol in self.symbols:
            try:
                logger.info(f"📊 Populating historical data for {symbol}...")
                
                # Get the best source for this specific symbol type
                symbol_source = self._get_best_historical_source_for_symbol(symbol)
                if not symbol_source:
                    logger.warning(f"⚠️  No suitable historical data source found for {symbol}, skipping")
                    continue
                
                logger.info(f"🎯 Using {symbol_source.name} for {symbol} historical data")
                
                # Fetch historical data (7 days should be enough for startup)
                historical_data = await symbol_source.get_historical_data(symbol, days=7)
                
                if not historical_data:
                    logger.warning(f"⚠️  No historical data received for {symbol}")
                    continue
                
                logger.info(f"📥 Received {len(historical_data)} historical data points for {symbol}")
                
                # Store in database
                stored_count = 0
                for price_data in historical_data:
                    try:
                        success = await self.db_manager.store_price(price_data)
                        if success:
                            stored_count += 1
                        else:
                            logger.warning(f"⚠️  Failed to store historical data point for {symbol}")
                    except Exception as e:
                        logger.warning(f"⚠️  Error storing historical data point for {symbol}: {e}")
                        continue
                
                # Store in cache (most recent data)
                if historical_data:
                    latest_data = historical_data[-1]  # Most recent
                    try:
                        await self.cache_manager.set_price(symbol, latest_data, ttl_seconds=3600)  # 1 hour TTL
                        logger.debug(f"💾 Cached latest price for {symbol}")
                    except Exception as e:
                        logger.warning(f"⚠️  Failed to cache latest price for {symbol}: {e}")
                
                total_populated += stored_count
                logger.info(f"✅ Successfully populated {symbol} with {stored_count}/{len(historical_data)} historical data points")
                
                # Rate limiting between symbols
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Failed to populate historical data for {symbol}: {type(e).__name__}: {e}")
                continue
        
        logger.info(f"🎉 Historical data population completed: {total_populated} total data points stored")
    
    async def _populate_historical_data_for_symbols(self, symbols: List[str]):
        """
        Populate the database with historical data for specific symbols.
        Uses API limits and validation to ensure efficient data collection.
        
        Args:
            symbols: List of symbols that need historical data population
        """
        logger.info(f"📚 Starting historical data population for {len(symbols)} symbols...")
        
        total_populated = 0
        
        for symbol in symbols:
            try:
                logger.info(f"📊 Populating historical data for {symbol}...")
                
                # Get data limits for this symbol
                limits = self.db_manager.get_historical_data_limits(symbol)
                max_days = limits['max_days']
                logger.info(f"📅 {symbol}: Maximum historical data allowed: {max_days} days")
                
                # Get the best source for this specific symbol type
                symbol_source = self._get_best_historical_source_for_symbol(symbol)
                if not symbol_source:
                    logger.warning(f"⚠️  No suitable historical data source found for {symbol}, skipping")
                    continue
                
                logger.info(f"🎯 Using {symbol_source.name} for {symbol} historical data")
                
                # Fetch historical data with API limit validation
                historical_data = await self._fetch_historical_data_with_limits(
                    symbol, symbol_source, max_days
                )
                
                if not historical_data:
                    logger.warning(f"⚠️  No historical data received for {symbol}")
                    continue
                
                logger.info(f"📥 Received {len(historical_data)} historical data points for {symbol}")
                
                # Store in database using bulk storage
                storage_result = await self.db_manager.store_historical_prices(symbol, historical_data)
                
                if storage_result['success']:
                    stored_count = storage_result['stored']
                    total_populated += stored_count
                    logger.info(f"✅ Successfully populated {symbol} with {stored_count}/{len(historical_data)} historical data points")
                    
                    # Store in cache (most recent data)
                    if historical_data:
                        latest_data = historical_data[-1]  # Most recent
                        try:
                            await self.cache_manager.set_price(symbol, latest_data, ttl_seconds=3600)  # 1 hour TTL
                            logger.debug(f"💾 Cached latest price for {symbol}")
                        except Exception as e:
                            logger.warning(f"⚠️  Failed to cache latest price for {symbol}: {e}")
                else:
                    logger.error(f"❌ Failed to store historical data for {symbol}: {storage_result.get('error', 'Unknown error')}")
                
                # Rate limiting between symbols to respect API limits
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"❌ Failed to populate historical data for {symbol}: {type(e).__name__}: {e}")
                continue
        
        logger.info(f"🎉 Historical data population completed: {total_populated} total data points stored")
    
    async def _fetch_historical_data_with_limits(self, symbol: str, data_source, max_days: int) -> List[PriceData]:
        """
        Fetch historical data with API limit validation and smart date range calculation.
        
        Args:
            symbol: Symbol to fetch data for
            data_source: Data source to use
            max_days: Maximum days allowed by API
            
        Returns:
            List of PriceData objects
        """
        logger.info(f"📡 Fetching historical data for {symbol} with {max_days} day limit")
        
        try:
            # Calculate optimal date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=max_days)
            
            logger.info(f"📅 Fetching data from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
            
            # Fetch historical data
            historical_data = await data_source.get_historical_data(symbol, days=max_days)
            
            if not historical_data:
                logger.warning(f"⚠️  No historical data received from {data_source.name} for {symbol}")
                return []
            
            # Validate and filter the data
            validated_data = []
            for price_data in historical_data:
                if self._validate_historical_price_data(price_data, symbol):
                    validated_data.append(price_data)
                else:
                    logger.debug(f"⚠️  Skipping invalid historical data point for {symbol}")
            
            logger.info(f"✅ Validated {len(validated_data)}/{len(historical_data)} historical data points for {symbol}")
            return validated_data
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch historical data for {symbol}: {type(e).__name__}: {e}")
            return []
    
    def _validate_historical_price_data(self, price_data: PriceData, symbol: str) -> bool:
        """
        Validate historical price data before storage.
        
        Args:
            price_data: PriceData object to validate
            symbol: Symbol for context
            
        Returns:
            True if valid, False otherwise
        """
        try:
            # Basic validation
            if not price_data.symbol or not price_data.timestamp:
                return False
            
            # Check price values are reasonable
            if not price_data.close_price or price_data.close_price <= 0:
                return False
            
            # Check timestamp is reasonable
            now = datetime.now()
            if price_data.timestamp > now + timedelta(days=1):
                return False
            
            if price_data.timestamp < now - timedelta(days=365*2):  # Not more than 2 years in past
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"⚠️  Historical price data validation error for {symbol}: {e}")
            return False
    
    async def add_new_instrument(self, symbol: str) -> bool:
        """
        Add a new instrument to the tracking list and populate it with historical data.
        
        Args:
            symbol: New symbol to add
            
        Returns:
            True if successfully added and populated, False otherwise
        """
        logger.info(f"➕ Adding new instrument: {symbol}")
        
        try:
            # Check if symbol is already being tracked
            if symbol in self.symbols:
                logger.info(f"ℹ️  {symbol} is already being tracked")
                return True
            
            # Check if we need historical data for this symbol
            needs_population = await self.db_manager.needs_historical_population(symbol, min_days=90)
            
            if needs_population:
                logger.info(f"📊 {symbol}: Needs historical data population")
                
                # Get data limits for this symbol
                limits = self.db_manager.get_historical_data_limits(symbol)
                max_days = limits['max_days']
                logger.info(f"📅 {symbol}: Maximum historical data allowed: {max_days} days")
                
                # Get the best source for this symbol type
                symbol_source = self._get_best_historical_source_for_symbol(symbol)
                if not symbol_source:
                    logger.error(f"❌ No suitable data source found for {symbol}")
                    return False
                
                logger.info(f"🎯 Using {symbol_source.name} for {symbol} historical data")
                
                # Fetch and store historical data
                historical_data = await self._fetch_historical_data_with_limits(
                    symbol, symbol_source, max_days
                )
                
                if historical_data:
                    # Store in database
                    storage_result = await self.db_manager.store_historical_prices(symbol, historical_data)
                    
                    if storage_result['success']:
                        logger.info(f"✅ Successfully populated {symbol} with {storage_result['stored']} historical data points")
                        
                        # Add to tracking list
                        self.symbols.append(symbol)
                        logger.info(f"✅ {symbol} added to tracking list")
                        
                        # Store in cache
                        latest_data = historical_data[-1]
                        try:
                            await self.cache_manager.set_price(symbol, latest_data, ttl_seconds=3600)
                            logger.debug(f"💾 Cached latest price for {symbol}")
                        except Exception as e:
                            logger.warning(f"⚠️  Failed to cache latest price for {symbol}: {e}")
                        
                        # Invalidate API cache for this new symbol
                        await self._invalidate_api_cache(symbol)
                        
                        return True
                    else:
                        logger.error(f"❌ Failed to store historical data for {symbol}: {storage_result.get('error', 'Unknown error')}")
                        return False
                else:
                    logger.error(f"❌ No historical data received for {symbol}")
                    return False
            else:
                logger.info(f"✅ {symbol}: Already has sufficient historical data")
                # Add to tracking list even if no population needed
                self.symbols.append(symbol)
                logger.info(f"✅ {symbol} added to tracking list")
                return True
                
        except Exception as e:
            logger.error(f"❌ Failed to add new instrument {symbol}: {type(e).__name__}: {e}")
            return False

    async def _invalidate_api_cache(self, symbol: str):
        """Invalidate API cache for a specific symbol after data changes."""
        try:
            # Import here to avoid circular imports
            import redis
            import os
            
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
                    logger.debug(f"🧹 Cleared {len(keys)} API cache entries for pattern: {pattern}")
            
            if total_cleared > 0:
                logger.info(f"🧹 API cache invalidated for symbol: {symbol}, cleared {total_cleared} entries")
            
            redis_client.close()
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to invalidate API cache for {symbol}: {type(e).__name__}: {e}")
            # Don't fail the main operation if cache invalidation fails
    
    def _get_best_historical_source(self):
        """
        Determine the best data source for historical data based on availability and rate limits.
        
        Returns:
            The best data source for historical data, or None if none available
        """
        logger.debug("🔍 Selecting best data source for historical data...")
        logger.info(f"🔍 Available data sources: {list(self.data_sources.keys())}")
        
        # Priority order: Alpha Vantage (best for historical), Yahoo, Finnhub
        priority_order = ['alpha_vantage', 'yahoo', 'finnhub']
        logger.info(f"🎯 Priority order for historical data: {priority_order}")
        
        for source_name in priority_order:
            logger.debug(f"🔍 Checking {source_name}...")
            if source_name in self.data_sources:
                source = self.data_sources[source_name]
                logger.info(f"✅ Selected {source.name} for historical data (priority: {priority_order.index(source_name) + 1})")
                logger.debug(f"🔍 Source object: {type(source).__name__}")
                return source
            else:
                logger.debug(f"❌ {source_name} not available in data sources")
        
        logger.error("❌ No data sources available for historical data")
        logger.error(f"🔍 Available sources: {list(self.data_sources.keys())}")
        return None
    
    def _get_best_historical_source_for_symbol(self, symbol: str):
        """
        Determine the best data source for historical data for a specific symbol type.
        
        Args:
            symbol: The symbol to get historical data for
            
        Returns:
            The best data source for historical data, or None if none available
        """
        is_crypto = self._is_crypto_symbol(symbol)
        logger.debug(f"🔍 Selecting best historical data source for {symbol} (crypto: {is_crypto})")
        
        if is_crypto:
            # For crypto, CoinGecko is best, then fallbacks
            priority_order = ['coingecko', 'yahoo', 'finnhub']
        else:
            # For stocks, Alpha Vantage is best, then fallbacks
            priority_order = ['alpha_vantage', 'yahoo', 'finnhub']
        
        logger.info(f"🎯 Priority order for {symbol} historical data: {priority_order}")
        
        for source_name in priority_order:
            if source_name in self.data_sources:
                source = self.data_sources[source_name]
                logger.info(f"✅ Selected {source.name} for {symbol} historical data")
                return source
        
        logger.error(f"❌ No suitable historical data source found for {symbol}")
        return None

    async def _check_cache_status(self) -> bool:
        """
        Check if the cache has recent price data.
        
        Returns:
            True if cache has recent data, False otherwise
        """
        logger.debug("🔍 Checking cache status...")
        
        try:
            cache_hits = 0
            for symbol in self.symbols:
                cached_price = await self.cache_manager.get_price(symbol)
                if cached_price:
                    cache_hits += 1
                    logger.debug(f"✅ Cache hit for {symbol}")
                else:
                    logger.debug(f"❌ Cache miss for {symbol}")
            
            if cache_hits > 0:
                logger.info(f"✅ Cache has data for {cache_hits}/{len(self.symbols)} symbols")
                return True
            else:
                logger.warning("⚠️  Cache is empty for all symbols")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error checking cache status: {type(e).__name__}: {e}")
            return False

    async def ingest_prices(self) -> Dict:
        """
        Main ingestion method that fetches prices for all tracked symbols.
        
        Returns:
            Dict with ingestion results and statistics
        """
        start_time = datetime.now()
        results = {
            'timestamp': start_time.isoformat(),
            'symbols_processed': 0,
            'symbols_successful': 0,
            'symbols_failed': 0,
            'sources_used': {},
            'errors': []
        }
        
        logger.info(f"🚀 Starting price ingestion for {len(self.symbols)} symbols")
        logger.info(f"📊 Symbols to process: {self.symbols}")
        logger.info(f"🔧 Available data sources: {list(self.data_sources.keys())}")
        
        # Log symbol type classification
        crypto_symbols = [s for s in self.symbols if self._is_crypto_symbol(s)]
        stock_symbols = [s for s in self.symbols if not self._is_crypto_symbol(s)]
        logger.info(f"🔍 Symbol classification: {len(crypto_symbols)} crypto, {len(stock_symbols)} stocks")
        if crypto_symbols:
            logger.info(f"🔍 Crypto symbols: {crypto_symbols}")
        if stock_symbols:
            logger.info(f"🔍 Stock symbols: {stock_symbols}")
        
        # Process symbols concurrently (but with rate limiting)
        semaphore = asyncio.Semaphore(5)  # Limit concurrent requests
        tasks = []
        
        for symbol in self.symbols:
            task = self._process_symbol_with_semaphore(semaphore, symbol, results)
            tasks.append(task)
        
        logger.info(f"📋 Created {len(tasks)} ingestion tasks")
        
        # Wait for all tasks to complete
        logger.info("⏳ Waiting for all ingestion tasks to complete...")
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Update statistics
        self.stats['total_requests'] += results['symbols_processed']
        self.stats['successful_requests'] += results['symbols_successful']
        self.stats['failed_requests'] += results['symbols_failed']
        self.stats['last_run'] = start_time.isoformat()
        
        duration = (datetime.now() - start_time).total_seconds()
        
        logger.info(
            f"✅ Ingestion completed in {duration:.2f}s. "
            f"📈 Processed: {results['symbols_processed']}, "
            f"✅ Successful: {results['symbols_successful']}, "
            f"❌ Failed: {results['symbols_failed']}"
        )
        
        if results['errors']:
            logger.warning(f"⚠️  Errors encountered during ingestion:")
            for error in results['errors']:
                logger.warning(f"   • {error}")
        
        if results['sources_used']:
            logger.info(f"🔍 Data sources used: {results['sources_used']}")
        
        return results
    
    async def _process_symbol_with_semaphore(self, semaphore: asyncio.Semaphore, 
                                           symbol: str, results: Dict):
        """Process a single symbol with concurrency control."""
        async with semaphore:
            await self._process_symbol(symbol, results)
    
    async def _process_symbol(self, symbol: str, results: Dict):
        """Process a single symbol through the data source chain."""
        results['symbols_processed'] += 1
        logger.info(f"🔄 Processing symbol: {symbol} ({results['symbols_processed']}/{len(self.symbols)})")
        
        try:
            # Check cache first
            logger.debug(f"🔍 Checking cache for {symbol}...")
            cached_price = await self.cache_manager.get_price(symbol)
            if cached_price and self._is_cache_fresh(cached_price):
                logger.info(f"✅ Using cached price for {symbol} (cache hit)")
                # Even with cache hit, ensure data is stored in database
                logger.debug(f"💾 Ensuring cached data for {symbol} is stored in database...")
                # Convert cached dict back to PriceData object
                from .database.models import PriceData
                cached_price_obj = PriceData.from_dict(cached_price)
                # Store both daily and intraday data for stocks
                is_crypto = self._is_crypto_symbol(symbol)
                if not is_crypto:
                    # Store as daily data
                    store_success = await self.db_manager.store_price(cached_price_obj)
                    # Also store as 5-minute intraday data during market hours
                    if self._is_market_hours():
                        await self.db_manager.store_price(cached_price_obj, interval_minutes=5)
                else:
                    # Crypto only goes to crypto_prices table
                    store_success = await self.db_manager.store_price(cached_price_obj)
                
                if store_success:
                    logger.info(f"✅ Successfully stored cached {symbol} in database")
                else:
                    logger.error(f"❌ Failed to store cached {symbol} in database")
                results['symbols_successful'] += 1
                return
            
            if cached_price:
                logger.debug(f"⏰ Cached price for {symbol} is stale, fetching fresh data")
            else:
                logger.debug(f"❌ No cached price found for {symbol}, fetching fresh data")
            
            # Select appropriate data sources based on symbol type
            price_data = None
            source_used = None
            
            # Determine if this is a cryptocurrency symbol
            is_crypto = self._is_crypto_symbol(symbol)
            logger.info(f"🔍 Symbol {symbol} is {'cryptocurrency' if is_crypto else 'stock'}")
            
            # Filter data sources based on symbol type
            if is_crypto:
                # For crypto, try CoinGecko first, then fallback to other sources
                crypto_sources = ['coingecko', 'finnhub', 'yahoo']
                available_sources = {k: v for k, v in self.data_sources.items() if k in crypto_sources}
                logger.info(f"🔍 Using crypto-appropriate sources for {symbol}: {list(available_sources.keys())}")
            else:
                # For stocks, prioritize sources with volume data (Alpha Vantage, Yahoo) over Finnhub
                stock_sources = ['alpha_vantage', 'yahoo', 'finnhub']
                available_sources = {k: v for k, v in self.data_sources.items() if k in stock_sources}
                logger.info(f"🔍 Using stock-appropriate sources for {symbol} (volume-priority order): {list(available_sources.keys())}")
            
            logger.info(f"🔍 Attempting to fetch {symbol} from {len(available_sources)} appropriate data sources...")
            
            for source_name, source in available_sources.items():
                try:
                    if not await source.can_make_request():
                        logger.debug(f"⏳ {source_name} rate limited for {symbol}, trying next source")
                        continue
                    
                    logger.debug(f"🔍 Trying {source_name} for {symbol}...")
                    price_data = await source.get_price(symbol)
                    
                    if price_data:
                        source_used = source_name
                        logger.info(f"✅ {source_name} successfully provided data for {symbol}")
                        break
                    else:
                        logger.warning(f"⚠️  {source_name} returned no data for {symbol}")
                        
                except DataSourceError as e:
                    logger.debug(f"⚠️  {source_name} failed for {symbol}: {e} (trying next source)")
                    continue
                except Exception as e:
                    logger.warning(f"⚠️  Unexpected error from {source_name} for {symbol}: {type(e).__name__}: {e}")
                    continue
            
            if not price_data:
                error_msg = f"All data sources failed for {symbol}"
                logger.error(f"💥 {error_msg}")
                raise IngestionError(error_msg)
            
            # Log the price data we're about to store
            logger.info(f"💾 Storing price data for {symbol}: Open=${price_data.open_price}, Close=${price_data.close_price}, Volume={price_data.volume}")
            
            # Store in database
            logger.debug(f"💾 Attempting to store {symbol} in database...")
            
            # Store both daily and intraday data for stocks
            is_crypto = self._is_crypto_symbol(symbol)
            if not is_crypto:
                # Store as daily data
                store_success = await self.db_manager.store_price(price_data)
                # Also store as 5-minute intraday data during market hours
                if self._is_market_hours():
                    await self.db_manager.store_price(price_data, interval_minutes=5)
                    logger.debug(f"📊 Also stored 5-minute intraday data for {symbol}")
            else:
                # Crypto only goes to crypto_prices table
                store_success = await self.db_manager.store_price(price_data)
            
            if store_success:
                logger.info(f"✅ Successfully stored {symbol} in database")
            else:
                logger.error(f"❌ Failed to store {symbol} in database")
                raise IngestionError(f"Database storage failed for {symbol}")
            
            # Update cache
            logger.debug(f"💾 Updating cache for {symbol}...")
            await self.cache_manager.set_price(symbol, price_data)
            logger.debug(f"✅ Cache updated for {symbol}")
            
            # Update statistics
            results['symbols_successful'] += 1
            if source_used:
                results['sources_used'][source_used] = results['sources_used'].get(source_used, 0) + 1
                self.stats['sources_used'][source_used] = self.stats['sources_used'].get(source_used, 0) + 1
            
            logger.info(f"🎉 Successfully processed {symbol} from {source_used}")
            
        except Exception as e:
            results['symbols_failed'] += 1
            error_msg = f"{symbol}: {str(e)}"
            results['errors'].append(error_msg)
            logger.error(f"💥 Failed to process {symbol}: {type(e).__name__}: {e}")
            logger.error(f"💥 Error details for {symbol}: {error_msg}")
    
    def _is_cache_fresh(self, cached_data: Dict, max_age_minutes: int = 15) -> bool:
        """Check if cached data is still fresh."""
        if not cached_data.get('timestamp'):
            logger.debug("Cache data has no timestamp, considering stale")
            return False
        
        try:
            cache_time = datetime.fromisoformat(cached_data['timestamp'])
            age = datetime.now() - cache_time
            is_fresh = age < timedelta(minutes=max_age_minutes)
            logger.debug(f"Cache age: {age.total_seconds()/60:.1f} minutes, fresh: {is_fresh}")
            return is_fresh
        except Exception as e:
            logger.warning(f"Error parsing cache timestamp: {e}")
            return False
    
    async def _test_data_sources(self):
        """Test connectivity to all data sources."""
        logger.info("🧪 Testing data source connectivity...")
        
        for source_name, source in self.data_sources.items():
            try:
                logger.info(f"🔍 Testing {source_name}...")
                
                # Get the test symbol this source will use
                test_symbol = getattr(source, '_get_health_check_symbol', lambda: 'SPY')()
                logger.info(f"🔍 {source_name} will test with symbol: {test_symbol}")
                
                # Check if this source is appropriate for the test symbol
                if hasattr(self, '_is_source_appropriate_for_symbol'):
                    is_appropriate = self._is_source_appropriate_for_symbol(source_name, test_symbol)
                    if not is_appropriate:
                        logger.warning(f"⚠️  {source_name} is not appropriate for testing with {test_symbol}, skipping health check")
                        continue
                
                test_result = await source.health_check()
                if test_result:
                    logger.info(f"✅ {source_name} is available and healthy")
                else:
                    logger.warning(f"⚠️  {source_name} health check failed, but continuing service startup")
            except Exception as e:
                logger.error(f"❌ {source_name} connectivity test failed: {type(e).__name__}: {e}")
                logger.warning(f"⚠️  {source_name} failed, but continuing service startup to avoid crash")
    
    async def get_stats(self) -> Dict:
        """Get ingestion statistics."""
        logger.debug("📊 Retrieving ingestion statistics...")
        stats = {
            **self.stats,
            'active_symbols': len(self.symbols),
            'available_sources': list(self.data_sources.keys()),
            'cache_stats': await self.cache_manager.get_stats(),
            'db_stats': await self.db_manager.get_stats()
        }
        logger.debug(f"📊 Retrieved stats: {stats}")
        return stats
    
    async def ingest_symbol(self, symbol: str) -> Dict:
        """
        Ingest price data for a single symbol.
        
        Args:
            symbol: The symbol to ingest
            
        Returns:
            Dict with ingestion results
        """
        logger.info(f"🔄 Starting price ingestion for {symbol}")
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'symbol': symbol,
            'success': False,
            'source_used': None,
            'error': None
        }
        
        try:
            # Check if symbol is in our tracked list
            if symbol not in self.symbols:
                raise ValueError(f"Symbol {symbol} is not in tracked symbols: {self.symbols}")
            
            # Process the single symbol
            await self._process_symbol(symbol, {
                'symbols_processed': 0,
                'symbols_successful': 0,
                'symbols_failed': 0,
                'sources_used': {},
                'errors': []
            })
            
            results['success'] = True
            logger.info(f"✅ Successfully ingested {symbol}")
            
        except Exception as e:
            results['error'] = str(e)
            logger.error(f"❌ Failed to ingest {symbol}: {type(e).__name__}: {e}")
        
        return results
    
    async def ingest_historical_data(self, symbol: str, days: int = 365) -> bool:
        """
        Ingest historical data for a symbol.
        
        Args:
            symbol: Stock symbol to fetch
            days: Number of days of history to fetch
            
        Returns:
            True if successful, False otherwise
        """
        logger.info(f"📚 Ingesting {days} days of historical data for {symbol}")
        
        try:
            # Use Alpha Vantage for historical data (best for this use case)
            alpha_vantage = self.data_sources.get('alpha_vantage')
            if not alpha_vantage:
                logger.error("❌ Alpha Vantage source not available for historical data")
                return False
            
            logger.info(f"🔍 Fetching historical data from Alpha Vantage for {symbol}...")
            historical_data = await alpha_vantage.get_historical_data(symbol, days)
            if not historical_data:
                logger.error(f"❌ No historical data returned for {symbol}")
                return False
            
            logger.info(f"📊 Retrieved {len(historical_data)} historical data points for {symbol}")
            
            # Store historical data
            stored_count = 0
            failed_count = 0
            
            for i, price_data in enumerate(historical_data):
                try:
                    logger.debug(f"💾 Storing historical data point {i+1}/{len(historical_data)} for {symbol}")
                    store_success = await self.db_manager.store_price(price_data)
                    if store_success:
                        stored_count += 1
                        logger.debug(f"✅ Stored historical data point {i+1} for {symbol}")
                    else:
                        failed_count += 1
                        logger.warning(f"⚠️  Failed to store historical data point {i+1} for {symbol}")
                except Exception as e:
                    failed_count += 1
                    logger.error(f"💥 Error storing historical data point {i+1} for {symbol}: {e}")
            
            logger.info(f"📊 Historical data ingestion for {symbol} completed: {stored_count} stored, {failed_count} failed")
            return stored_count > 0
            
        except Exception as e:
            logger.error(f"💥 Failed to ingest historical data for {symbol}: {type(e).__name__}: {e}")
            return False
    
    async def close(self):
        """Close all connections and cleanup resources."""
        logger.info("🔄 Closing price ingester...")
        
        try:
            await self.cache_manager.close()
            logger.info("✅ Cache manager closed")
            
            await self.db_manager.close()
            logger.info("✅ Database manager closed")
            
            # Close data sources
            for source_name, source in self.data_sources.items():
                if hasattr(source, 'close'):
                    try:
                        await source.close()
                        logger.info(f"✅ {source_name} data source closed")
                    except Exception as e:
                        logger.warning(f"⚠️  Error closing {source_name}: {e}")
            
            logger.info("✅ Price ingester closed successfully")
            
        except Exception as e:
            logger.error(f"💥 Error during ingester cleanup: {type(e).__name__}: {e}")