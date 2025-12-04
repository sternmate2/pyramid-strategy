"""
Scheduling utilities for the price ingestion service.
"""

import asyncio
import schedule
from datetime import datetime, time
from typing import Callable, Optional
import pytz

from .config import config
from .logger import logger


class PriceScheduler:
    """
    Manages scheduling of price ingestion tasks.
    """
    
    def __init__(self, ingester):
        self.ingester = ingester
        self.running = False
        self.scheduler_task: Optional[asyncio.Task] = None
        self.timezone = pytz.timezone('UTC')  # Market timezone (NASDAQ in UTC)
        logger.info("PriceScheduler initialized")
        logger.info(f"🌍 Using timezone: {self.timezone}")
    
    async def start(self):
        """Start the price ingestion scheduler."""
        logger.info("🚀 Starting price ingestion scheduler...")
        
        try:
            # Clear any existing jobs
            logger.debug("🧹 Clearing existing scheduled jobs...")
            schedule.clear()
            logger.debug("✅ Existing jobs cleared")
            
            # Schedule real-time ingestion during market hours
            logger.info("📅 Setting up market hours ingestion schedule...")
            self._schedule_market_hours_ingestion()
            
            # Schedule daily historical data updates
            logger.info("📅 Setting up daily task schedule...")
            self._schedule_daily_tasks()
            
            # Start the scheduler loop
            logger.info("🔄 Starting scheduler loop...")
            self.running = True
            self.scheduler_task = asyncio.create_task(self._scheduler_loop())
            
            logger.info("✅ Price ingestion scheduler started successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to start scheduler: {type(e).__name__}: {e}")
            raise
    
    async def stop(self):
        """Stop the scheduler."""
        logger.info("🛑 Stopping price ingestion scheduler...")
        self.running = False
        
        if self.scheduler_task and not self.scheduler_task.done():
            logger.debug("🔄 Cancelling scheduler task...")
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
                logger.debug("✅ Scheduler task cancelled successfully")
            except asyncio.CancelledError:
                logger.debug("✅ Scheduler task was cancelled")
            except Exception as e:
                logger.warning(f"⚠️  Error while cancelling scheduler task: {e}")
        
        logger.debug("🧹 Clearing scheduled jobs...")
        schedule.clear()
        logger.info("✅ Price ingestion scheduler stopped")
    
    def _schedule_market_hours_ingestion(self):
        """Schedule ingestion during market hours and 24/7 crypto."""
        interval = config.REALTIME_INTERVAL
        
        # Schedule for each interval during market hours (9:30 AM - 4:00 PM ET)
        # This is a simplified approach - in production you'd want more sophisticated scheduling
        
        # NASDAQ market hours: 2:30 PM to 9:00 PM UTC
        market_start = time(config.MARKET_OPEN_HOUR, config.MARKET_OPEN_MINUTE)
        market_end = time(config.MARKET_CLOSE_HOUR, config.MARKET_CLOSE_MINUTE)
        
        logger.info(f"⏰ NASDAQ market hours: {market_start.strftime('%H:%M')} - {market_end.strftime('%H:%M')} UTC")
        logger.info(f"🔄 Stock ingestion interval: every {interval} minutes (during market hours only)")
        logger.info(f"🪙 Crypto ingestion interval: every {interval} minutes (24/7)")
        
        # Schedule every X minutes during market hours
        schedule.every(interval).minutes.do(self._run_market_hours_ingestion)
        
        # Schedule 24/7 cryptocurrency ingestion (using REALTIME_INTERVAL)
        logger.info(f"🪙 Scheduling 24/7 cryptocurrency ingestion every {interval} minute...")
        schedule.every(interval).minutes.do(self._run_crypto_ingestion)
        
        logger.info(f"✅ Scheduled market hours ingestion every {interval} minutes")
        logger.info(f"✅ Scheduled 24/7 crypto ingestion every {interval} minute")
        logger.info(f"📋 Next scheduled run: {schedule.next_run()}")
    
    async def add_symbol(self, symbol: str):
        """
        Add a new symbol to the scheduler.
        
        Args:
            symbol: New symbol to add
        """
        logger.info(f"➕ Adding {symbol} to scheduler...")
        
        try:
            # Check if this is a cryptocurrency symbol
            is_crypto = self._is_crypto_symbol(symbol)
            
            if is_crypto:
                logger.info(f"🪙 {symbol} is a cryptocurrency, will be included in 24/7 ingestion")
            else:
                logger.info(f"📊 {symbol} is a stock, will be included in market hours ingestion")
            
            # The symbol will automatically be included in the next scheduled run
            # since the ingester.symbols list is used in the ingestion methods
            logger.info(f"✅ {symbol} added to scheduler successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to add {symbol} to scheduler: {type(e).__name__}: {e}")
    
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
    
    def _schedule_daily_tasks(self):
        """Schedule daily maintenance tasks."""
        logger.info("📅 Setting up daily scheduled tasks...")
        
        # Schedule historical data updates after market close
        historical_time = "17:00"
        schedule.every().day.at(historical_time).do(self._run_daily_historical_update)
        logger.info(f"✅ Scheduled daily historical update at {historical_time}")
        
        # Schedule database maintenance at night
        maintenance_time = "02:00"
        schedule.every().day.at(maintenance_time).do(self._run_daily_maintenance)
        logger.info(f"✅ Scheduled daily maintenance at {maintenance_time}")
        
        logger.info(f"📋 Total scheduled jobs: {len(schedule.jobs)}")
    
    def _is_market_hours(self) -> bool:
        """Check if current time is during NASDAQ market hours (2:30 PM - 9:00 PM UTC)."""
        try:
            from .config import config
            current_time = datetime.now(self.timezone)
            
            # Check if it's a weekday (Monday = 0, Sunday = 6)
            if current_time.weekday() > 4:  # Saturday = 5, Sunday = 6
                return False
            
            current_time_only = current_time.time()
            market_open = time(config.MARKET_OPEN_HOUR, config.MARKET_OPEN_MINUTE)
            market_close = time(config.MARKET_CLOSE_HOUR, config.MARKET_CLOSE_MINUTE)
            
            return market_open <= current_time_only <= market_close
            
        except Exception as e:
            logger.warning(f"Error checking market hours: {e}")
            return False
    
    def _run_market_hours_ingestion(self):
        """Run ingestion only during market hours."""
        current_time = datetime.now(self.timezone)
        logger.info(f"🕐 Market hours ingestion triggered at {current_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        
        if self._is_market_hours():
            logger.info("✅ Market hours ingestion: NASDAQ market is open, proceeding with stock ingestion")
            asyncio.create_task(self._safe_run_ingestion())
        else:
            logger.info("⏸️  Market hours ingestion: NASDAQ market is closed, skipping stock ingestion")
            logger.debug(f"🔍 Market status check: weekday={current_time.weekday()}, time={current_time.time()}")
    
    def _run_crypto_ingestion(self):
        """Run 24/7 cryptocurrency ingestion."""
        current_time = datetime.now(self.timezone)
        logger.info(f"🪙 Crypto ingestion triggered at {current_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        
        # Crypto trades 24/7, so always run
        logger.info("✅ Crypto ingestion: Running 24/7 cryptocurrency ingestion")
        asyncio.create_task(self._safe_run_crypto_ingestion())
    
    def _run_daily_historical_update(self):
        """Run daily historical data update."""
        current_time = datetime.now(self.timezone)
        logger.info(f"📚 Daily historical update triggered at {current_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        asyncio.create_task(self._safe_run_historical_update())
    
    def _run_daily_maintenance(self):
        """Run daily maintenance tasks."""
        current_time = datetime.now(self.timezone)
        logger.info(f"🔧 Daily maintenance triggered at {current_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        asyncio.create_task(self._safe_run_maintenance())
    
    async def _safe_run_ingestion(self):
        """Safely run price ingestion with error handling."""
        logger.info("🔄 Starting scheduled price ingestion...")
        start_time = datetime.now()
        
        try:
            results = await self.ingester.ingest_prices()
            duration = (datetime.now() - start_time).total_seconds()
            
            logger.info(
                f"✅ Scheduled ingestion completed in {duration:.2f}s: "
                f"{results['symbols_successful']}/{results['symbols_processed']} successful"
            )
            
            if results['errors']:
                logger.warning(f"⚠️  Scheduled ingestion had {len(results['errors'])} errors:")
                for error in results['errors']:
                    logger.warning(f"   • {error}")
            
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"❌ Scheduled ingestion failed after {duration:.2f}s: {type(e).__name__}: {e}")
    
    async def _safe_run_crypto_ingestion(self):
        """Safely run cryptocurrency ingestion with error handling."""
        logger.info("🪙 Starting scheduled cryptocurrency ingestion...")
        start_time = datetime.now()
        
        try:
            # Get crypto symbols from the ingester
            crypto_symbols = [symbol for symbol in self.ingester.symbols 
                            if hasattr(self.ingester, '_is_crypto_symbol') and 
                            self.ingester._is_crypto_symbol(symbol)]
            
            if not crypto_symbols:
                logger.info("🪙 No cryptocurrency symbols configured, skipping crypto ingestion")
                return
            
            logger.info(f"🪙 Processing {len(crypto_symbols)} cryptocurrency symbols: {crypto_symbols}")
            
            # Run ingestion for crypto symbols only
            successful_updates = 0
            failed_updates = 0
            
            for symbol in crypto_symbols:
                try:
                    logger.info(f"🪙 Ingesting {symbol}...")
                    await self.ingester.ingest_symbol(symbol)
                    successful_updates += 1
                    logger.info(f"✅ {symbol} ingestion completed")
                except Exception as e:
                    failed_updates += 1
                    logger.error(f"❌ {symbol} ingestion failed: {type(e).__name__}: {e}")
                
                # Small delay between symbols to avoid rate limits
                await asyncio.sleep(1)
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"🪙 Cryptocurrency ingestion completed in {duration:.2f}s: "
                f"{successful_updates} successful, {failed_updates} failed"
            )
            
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"❌ Cryptocurrency ingestion failed after {duration:.2f}s: {type(e).__name__}: {e}")
    
    async def _safe_run_historical_update(self):
        """Safely run historical data update."""
        logger.info("📚 Starting scheduled historical data update...")
        start_time = datetime.now()
        
        try:
            total_symbols = len(config.TRACKED_SYMBOLS)
            successful_updates = 0
            failed_updates = 0
            
            logger.info(f"📊 Processing {total_symbols} symbols for historical update...")
            
            for i, symbol in enumerate(config.TRACKED_SYMBOLS, 1):
                logger.info(f"🔄 Processing {symbol} ({i}/{total_symbols}) for historical update...")
                
                try:
                    success = await self.ingester.ingest_historical_data(symbol, days=30)
                    if success:
                        successful_updates += 1
                        logger.info(f"✅ Updated historical data for {symbol}")
                    else:
                        failed_updates += 1
                        logger.warning(f"⚠️  Failed to update historical data for {symbol}")
                    
                except Exception as e:
                    failed_updates += 1
                    logger.error(f"❌ Error updating historical data for {symbol}: {type(e).__name__}: {e}")
                
                # Small delay between symbols to avoid rate limits
                if i < total_symbols:  # Don't delay after the last symbol
                    logger.debug(f"⏳ Waiting 2 seconds before next symbol...")
                    await asyncio.sleep(2)
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"📚 Historical data update completed in {duration:.2f}s: "
                f"{successful_updates} successful, {failed_updates} failed"
            )
                
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"❌ Historical data update failed after {duration:.2f}s: {type(e).__name__}: {e}")
    
    async def _safe_run_maintenance(self):
        """Safely run maintenance tasks."""
        logger.info("🔧 Starting scheduled daily maintenance...")
        start_time = datetime.now()
        
        try:
            # Clean up old cache entries
            if hasattr(self.ingester, 'cache_manager'):
                logger.info("🧹 Cleaning up old cache entries...")
                await self.ingester.cache_manager.clear_cache("price:*:historical:*")
                logger.info("✅ Cache cleanup completed")
            else:
                logger.warning("⚠️  Cache manager not available for maintenance")
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"✅ Daily maintenance completed in {duration:.2f}s")
            
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"❌ Daily maintenance failed after {duration:.2f}s: {type(e).__name__}: {e}")
    
    async def _scheduler_loop(self):
        """Main scheduler loop."""
        logger.info("🔄 Scheduler loop started")
        
        while self.running:
            try:
                # Run pending scheduled jobs
                pending_jobs = schedule.jobs
                if pending_jobs:
                    logger.debug(f"📋 Checking {len(pending_jobs)} scheduled jobs...")
                    schedule.run_pending()
                else:
                    logger.debug("📋 No scheduled jobs to check")
                
                # Sleep for a short interval
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except asyncio.CancelledError:
                logger.info("🔄 Scheduler loop cancelled")
                break
            except Exception as e:
                logger.error(f"❌ Scheduler loop error: {type(e).__name__}: {e}")
                logger.error(f"🔍 Scheduler error details: {str(e)}")
                await asyncio.sleep(60)  # Longer sleep on error
        
        logger.info("🔄 Scheduler loop stopped")
    
    def _is_market_hours(self) -> bool:
        """Check if current time is within market hours."""
        now = datetime.now(self.timezone)
        current_time = now.time()
        current_weekday = now.weekday()
        
        # Market is closed on weekends
        if current_weekday >= 5:  # Saturday = 5, Sunday = 6
            logger.debug(f"📅 Weekend detected (weekday {current_weekday}), market closed")
            return False
        
        # Check if within trading hours (9:30 AM - 4:00 PM ET)
        market_start = time(config.MARKET_OPEN_HOUR, config.MARKET_OPEN_MINUTE)
        market_end = time(config.MARKET_CLOSE_HOUR, config.MARKET_CLOSE_MINUTE)
        
        is_open = market_start <= current_time <= market_end
        
        if is_open:
            logger.debug(f"🕐 Market is open: {current_time.strftime('%H:%M:%S')} is within {market_start.strftime('%H:%M')}-{market_end.strftime('%H:%M')}")
        else:
            logger.debug(f"🕐 Market is closed: {current_time.strftime('%H:%M:%S')} is outside {market_start.strftime('%H:%M')}-{market_end.strftime('%H:%M')}")
        
        return is_open
    
    def _is_trading_day(self) -> bool:
        """Check if today is a trading day (simplified - doesn't account for holidays)."""
        today = datetime.now(self.timezone)
        is_trading_day = today.weekday() < 5  # Monday = 0, Friday = 4
        
        logger.debug(f"📅 Trading day check: weekday {today.weekday()} ({today.strftime('%A')}), is_trading_day: {is_trading_day}")
        return is_trading_day
    
    async def trigger_manual_ingestion(self):
        """Manually trigger price ingestion."""
        logger.info("👆 Manual ingestion triggered")
        await self._safe_run_ingestion()
    
    async def get_next_scheduled_run(self) -> Optional[str]:
        """Get the next scheduled run time."""
        if not schedule.jobs:
            logger.debug("📋 No scheduled jobs found")
            return None
        
        next_run = min(job.next_run for job in schedule.jobs)
        next_run_str = next_run.isoformat() if next_run else None
        
        logger.debug(f"📋 Next scheduled run: {next_run_str}")
        return next_run_str
    
    def get_schedule_info(self) -> dict:
        """Get information about scheduled jobs."""
        schedule_info = {
            'running': self.running,
            'total_jobs': len(schedule.jobs),
            'market_hours_interval': config.REALTIME_INTERVAL,
            'timezone': str(self.timezone),
            'jobs': [
                {
                    'interval': str(job.interval),
                    'unit': job.unit,
                    'at_time': str(job.at_time) if job.at_time else None,
                    'next_run': job.next_run.isoformat() if job.next_run else None
                }
                for job in schedule.jobs
            ]
        }
        
        logger.debug(f"📋 Schedule info: {schedule_info}")
        return schedule_info