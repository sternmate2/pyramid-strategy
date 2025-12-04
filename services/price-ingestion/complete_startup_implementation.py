"""
Complete Startup Data Initialization Implementation

This file contains the complete implementation that should replace the current
_initialize_startup_data method in src/ingester.py.

Copy the methods below and replace the existing _initialize_startup_data method.
"""

async def _initialize_startup_data(self):
    """
    Check if database has recent price data and populate with historical data if needed.
    This ensures the service has data to work with on first startup.
    """
    logger.info("🚀 Starting startup data initialization check...")
    
    try:
        # Check if we have recent data in the database
        has_recent_data = await self._check_recent_data_exists()
        
        if has_recent_data:
            logger.info("✅ Database already has recent price data, skipping historical population")
            return
        
        logger.warning("⚠️  No recent price data found in database")
        logger.info("📚 Populating database with historical data from past week...")
        
        # Populate with historical data from the past week
        await self._populate_startup_historical_data()
        
        logger.info("✅ Startup data initialization completed successfully")
        
    except Exception as e:
        logger.error(f"❌ Startup data initialization failed: {type(e).__name__}: {e}")
        logger.warning("⚠️  Continuing with service startup despite historical data failure")
        # Don't fail the entire service if historical data population fails

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
            
            # Fetch historical data (7 days should be enough for startup)
            historical_data = await best_source.get_historical_data(symbol, days=7)
            
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

def _get_best_historical_source(self):
    """
    Determine the best data source for historical data based on availability and rate limits.
    
    Returns:
        The best data source for historical data, or None if none available
    """
    logger.debug("🔍 Selecting best data source for historical data...")
    
    # Priority order: Alpha Vantage (best for historical), Yahoo, Finnhub
    priority_order = ['alpha_vantage', 'yahoo', 'finnhub']
    
    for source_name in priority_order:
        if source_name in self.data_sources:
            source = self.data_sources[source_name]
            logger.info(f"✅ Selected {source.name} for historical data (priority: {priority_order.index(source_name) + 1})")
            return source
    
    logger.error("❌ No data sources available for historical data")
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

"""
INSTRUCTIONS TO IMPLEMENT:

1. Open src/ingester.py
2. Find the current _initialize_startup_data method (around line 255)
3. Replace the entire method with the new implementation above
4. Add the three new helper methods after it:
   - _check_recent_data_exists
   - _populate_startup_historical_data  
   - _get_best_historical_source
   - _check_cache_status
5. Save the file
6. Test the service

The new implementation will:
- Check if database has recent data (last 7 days)
- If no data found, fetch historical data from past week
- Populate both database and Redis cache
- Use the best available data source (Alpha Vantage priority)
- Provide detailed logging of the entire process
"""
