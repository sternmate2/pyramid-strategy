#!/usr/bin/env python3
"""
Test script for enhanced logging in the price ingestion service.
This script helps verify that all the detailed logging is working correctly.
"""

import asyncio
import sys
from pathlib import Path

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.utils.logger import logger
from src.utils.config import config
from src.ingester import PriceIngester


async def test_logging():
    """Test the enhanced logging functionality."""
    logger.info("🧪 Starting logging test...")
    
    try:
        # Test basic logging
        logger.debug("🔍 This is a debug message")
        logger.info("ℹ️  This is an info message")
        logger.warning("⚠️  This is a warning message")
        logger.error("❌ This is an error message")
        
        # Test configuration logging
        logger.info(f"🌍 Environment: {config.ENVIRONMENT}")
        logger.info(f"📊 Tracked symbols: {config.TRACKED_SYMBOLS}")
        logger.info(f"⏰ Ingestion interval: {config.REALTIME_INTERVAL} minutes")
        logger.info(f"🔌 Database URL: {config.DATABASE_URL.split('@')[1] if '@' in config.DATABASE_URL else 'localhost'}")
        
        # Test API key logging
        if config.FINNHUB_API_KEY:
            logger.info("✅ Finnhub API key configured")
        else:
            logger.warning("⚠️  Finnhub API key not configured")
        
        if config.ALPHAVANTAGE_API_KEY:
            logger.info("✅ Alpha Vantage API key configured")
        else:
            logger.warning("⚠️  Alpha Vantage API key not configured")
        
        # Test ingester initialization (without database connection)
        logger.info("🔧 Testing ingester initialization...")
        ingester = PriceIngester()
        logger.info("✅ Ingester created successfully")
        
        # Test stats retrieval
        logger.info("📊 Testing stats retrieval...")
        stats = await ingester.get_stats()
        logger.info(f"📊 Retrieved stats: {stats}")
        
        logger.info("✅ All logging tests completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Logging test failed: {type(e).__name__}: {e}")
        logger.error(f"🔍 Error details: {str(e)}")
        raise


async def test_data_source_logging():
    """Test data source logging specifically."""
    logger.info("🧪 Testing data source logging...")
    
    try:
        from src.data_sources import DataSourceFactory
        
        # Test data source creation
        logger.info("🔧 Creating data sources...")
        data_sources = DataSourceFactory.create_all()
        logger.info(f"✅ Created {len(data_sources)} data sources: {list(data_sources.keys())}")
        
        # Test health checks
        for source_name, source in data_sources.items():
            logger.info(f"🧪 Testing health check for {source_name}...")
            try:
                health_result = await source.health_check()
                if health_result:
                    logger.info(f"✅ {source_name} health check passed")
                else:
                    logger.warning(f"⚠️  {source_name} health check failed")
            except Exception as e:
                logger.error(f"❌ {source_name} health check error: {type(e).__name__}: {e}")
        
        logger.info("✅ Data source logging tests completed!")
        
    except Exception as e:
        logger.error(f"❌ Data source logging test failed: {type(e).__name__}: {e}")
        raise


async def main():
    """Main test function."""
    logger.info("🚀 Starting comprehensive logging tests...")
    
    try:
        # Test basic logging
        await test_logging()
        
        # Test data source logging
        await test_data_source_logging()
        
        logger.info("🎉 All tests completed successfully!")
        
    except Exception as e:
        logger.error(f"💥 Test suite failed: {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # Configure event loop for Windows compatibility
    if sys.platform == "win32":
        logger.info("🪟 Windows platform detected, configuring event loop policy...")
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Run the tests
    asyncio.run(main())
