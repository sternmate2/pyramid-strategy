#!/usr/bin/env python3
"""
Stock Anomaly Detection System - Price Ingestion Service
Main entry point for the price data ingestion service.
"""

import asyncio
import signal
import sys
from pathlib import Path
from datetime import datetime

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.ingester import PriceIngester
from src.utils.config import config
from src.utils.logger import logger
from src.utils.scheduler import PriceScheduler
from src.web_server import IngestionWebServer


class IngestionService:
    """Main ingestion service orchestrator."""
    
    def __init__(self):
        logger.info("🔧 Initializing Stock Price Ingestion Service...")
        self.ingester = PriceIngester()
        self.scheduler = PriceScheduler(self.ingester)
        self.web_server = IngestionWebServer(port=8080)
        self.running = False
        logger.info("✅ IngestionService initialized")
    
    async def start(self):
        """Start the ingestion service."""
        try:
            logger.info("🚀 Starting Stock Price Ingestion Service...")
            logger.info(f"🌍 Environment: {config.ENVIRONMENT}")
            logger.info(f"📊 Tracked symbols: {config.TRACKED_SYMBOLS}")
            logger.info(f"⏰ Ingestion interval: {config.REALTIME_INTERVAL} minutes")
            logger.info(f"🔌 Database URL: {config.DATABASE_URL.split('@')[1] if '@' in config.DATABASE_URL else 'localhost'}")
            logger.info(f"📡 Redis: {config.REDIS_HOST}:{config.REDIS_PORT}")
            logger.info(f"📝 Log level: {config.LOG_LEVEL}")
            logger.info(f"📝 Log format: {config.LOG_FORMAT}")
            
            # Log API key availability
            if config.FINNHUB_API_KEY:
                logger.info("✅ Finnhub API key configured")
            else:
                logger.warning("⚠️  Finnhub API key not configured")
            
            if config.ALPHAVANTAGE_API_KEY:
                logger.info("✅ Alpha Vantage API key configured")
            else:
                logger.warning("⚠️  Alpha Vantage API key not configured")
            
            # Start web server first
            logger.info("🌐 Starting web server...")
            self.web_server.start()
            logger.info("✅ Web server started successfully")
            
            # Initialize database
            logger.info("🔌 Initializing database connection...")
            await self.ingester.initialize()
            logger.info("✅ Database initialization completed")
            logger.info("📊 Startup data initialization completed")
            logger.info("🔍 Service is now ready with historical data foundation")
            
            # Start scheduler
            logger.info("📅 Starting price ingestion scheduler...")
            self.running = True
            await self.scheduler.start()
            logger.info("✅ Scheduler started successfully")
            
            logger.info("🎉 Price ingestion service started successfully")
            logger.info("📋 Service is now running and monitoring for scheduled tasks")
            
            # Keep service running
            while self.running:
                await asyncio.sleep(1)
                
        except Exception as e:
            logger.error(f"❌ Failed to start ingestion service: {type(e).__name__}: {e}")
            logger.error(f"🔍 Service startup error details: {str(e)}")
            raise
    
    async def stop(self):
        """Stop the ingestion service gracefully."""
        logger.info("🛑 Stopping price ingestion service...")
        self.running = False
        
        try:
            if self.web_server:
                logger.info("🌐 Stopping web server...")
                self.web_server.stop()
                logger.info("✅ Web server stopped")
            
            if self.scheduler:
                logger.info("📅 Stopping scheduler...")
                await self.scheduler.stop()
                logger.info("✅ Scheduler stopped")
            
            if self.ingester:
                logger.info("🔄 Closing ingester...")
                await self.ingester.close()
                logger.info("✅ Ingester closed")
            
            logger.info("✅ Price ingestion service stopped gracefully")
            
        except Exception as e:
            logger.error(f"❌ Error during service shutdown: {type(e).__name__}: {e}")
    
    async def add_new_instrument(self, symbol: str) -> bool:
        """
        Add a new instrument to the tracking list and populate it with historical data.
        
        Args:
            symbol: New symbol to add
            
        Returns:
            True if successfully added and populated, False otherwise
        """
        try:
            logger.info(f"➕ Adding new instrument via service: {symbol}")
            success = await self.ingester.add_new_instrument(symbol)
            
            if success:
                logger.info(f"✅ Successfully added new instrument: {symbol}")
                # Update the scheduler to include the new symbol
                if self.scheduler:
                    await self.scheduler.add_symbol(symbol)
                    logger.info(f"📅 Added {symbol} to scheduler")
            else:
                logger.error(f"❌ Failed to add new instrument: {symbol}")
            
            return success
            
        except Exception as e:
            logger.error(f"❌ Error adding new instrument {symbol}: {type(e).__name__}: {e}")
            return False
    
    async def get_tracked_symbols(self) -> list:
        """
        Get the current list of tracked symbols.
        
        Returns:
            List of currently tracked symbols
        """
        return self.ingester.symbols.copy()
    
    async def health_check(self) -> dict:
        """
        Perform a health check of the service.
        
        Returns:
            Dictionary with health status information
        """
        try:
            status = {
                'service': 'price-ingestion',
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'tracked_symbols': len(self.ingester.symbols),
                'symbols': self.ingester.symbols.copy(),
                'scheduler_running': self.scheduler.running if self.scheduler else False
            }
            
            # Check database connection
            try:
                if self.ingester.db_manager and self.ingester.db_manager.pool:
                    status['database'] = 'connected'
                else:
                    status['database'] = 'disconnected'
            except:
                status['database'] = 'error'
            
            # Check cache connection
            try:
                if self.ingester.cache_manager and self.ingester.cache_manager.redis:
                    status['cache'] = 'connected'
                else:
                    status['cache'] = 'disconnected'
            except:
                status['cache'] = 'error'
            
            return status
            
        except Exception as e:
            return {
                'service': 'price-ingestion',
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        signal_names = {
            signal.SIGTERM: 'SIGTERM',
            signal.SIGINT: 'SIGINT'
        }
        signal_name = signal_names.get(signum, f'SIGNAL_{signum}')
        
        logger.info(f"📡 Received signal {signal_name} ({signum}), initiating graceful shutdown...")
        self.running = False


async def main():
    """Main entry point."""
    logger.info("🎬 Starting Stock Price Ingestion Service...")
    
    try:
        service = IngestionService()
        logger.info("✅ Service instance created")
        
        # Register signal handlers
        logger.info("📡 Registering signal handlers...")
        for sig in [signal.SIGTERM, signal.SIGINT]:
            signal.signal(sig, lambda s, f: service.signal_handler(s, f))
        logger.info("✅ Signal handlers registered")
        
        # Start the service
        logger.info("🚀 Starting service...")
        await service.start()
        
    except KeyboardInterrupt:
        logger.info("⌨️  Received keyboard interrupt")
    except Exception as e:
        logger.error(f"💥 Service error: {type(e).__name__}: {e}")
        logger.error(f"🔍 Service error details: {str(e)}")
        sys.exit(1)
    finally:
        logger.info("🔄 Shutting down service...")
        await service.stop()
        logger.info("👋 Service shutdown complete")


if __name__ == "__main__":
    # Configure event loop for Windows compatibility
    if sys.platform == "win32":
        logger.info("🪟 Windows platform detected, configuring event loop policy...")
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        logger.info("✅ Windows event loop policy configured")
    
    logger.info("🚀 Launching Stock Price Ingestion Service...")
    
    # Run the service
    try:
        asyncio.run(main())
    except Exception as e:
        logger.error(f"💥 Fatal error in main: {type(e).__name__}: {e}")
        logger.error(f"🔍 Fatal error details: {str(e)}")
        sys.exit(1)