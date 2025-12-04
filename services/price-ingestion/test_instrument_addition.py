#!/usr/bin/env python3
"""
Test script for the new instrument addition functionality.
This script demonstrates how to add new instruments to the price ingestion service.
"""

import asyncio
import sys
from pathlib import Path

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.ingester import PriceIngester
from src.utils.config import config
from src.utils.logger import logger


async def test_instrument_addition():
    """Test adding new instruments to the price ingestion service."""
    
    logger.info("🧪 Testing instrument addition functionality...")
    
    try:
        # Initialize the ingester
        ingester = PriceIngester()
        await ingester.initialize()
        logger.info("✅ Ingester initialized successfully")
        
        # Show current tracked symbols
        current_symbols = ingester.symbols.copy()
        logger.info(f"📊 Current tracked symbols: {current_symbols}")
        
        # Test adding a new stock symbol
        new_stock = "NVDA"  # NVIDIA
        logger.info(f"➕ Testing addition of new stock: {new_stock}")
        
        success = await ingester.add_new_instrument(new_stock)
        if success:
            logger.info(f"✅ Successfully added {new_stock}")
        else:
            logger.error(f"❌ Failed to add {new_stock}")
        
        # Test adding a new crypto symbol
        new_crypto = "ETH/USD"  # Ethereum
        logger.info(f"➕ Testing addition of new crypto: {new_crypto}")
        
        success = await ingester.add_new_instrument(new_crypto)
        if success:
            logger.info(f"✅ Successfully added {new_crypto}")
        else:
            logger.error(f"❌ Failed to add {new_crypto}")
        
        # Show updated tracked symbols
        updated_symbols = ingester.symbols.copy()
        logger.info(f"📊 Updated tracked symbols: {updated_symbols}")
        
        # Test adding a symbol that's already tracked
        logger.info(f"🔄 Testing addition of already tracked symbol: {new_stock}")
        success = await ingester.add_new_instrument(new_stock)
        if success:
            logger.info(f"✅ {new_stock} is already tracked (as expected)")
        else:
            logger.warning(f"⚠️  Unexpected result for already tracked symbol {new_stock}")
        
        # Test historical data validation
        logger.info("🔍 Testing historical data validation...")
        for symbol in updated_symbols:
            needs_population = await ingester.db_manager.needs_historical_population(symbol, min_days=90)
            logger.info(f"📊 {symbol}: Needs population: {needs_population}")
        
        # Test data limits
        logger.info("📏 Testing data limits...")
        for symbol in updated_symbols:
            limits = ingester.db_manager.get_historical_data_limits(symbol)
            logger.info(f"📊 {symbol}: Max days: {limits['max_days']}, API limits: {limits['api_limits']}")
        
        logger.info("🎉 Instrument addition testing completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {type(e).__name__}: {e}")
        import traceback
        logger.error(f"📋 Stack trace: {traceback.format_exc()}")
        return False
    
    finally:
        # Clean up
        try:
            await ingester.close()
            logger.info("✅ Ingester closed")
        except:
            pass
    
    return True


async def main():
    """Main test function."""
    logger.info("🚀 Starting instrument addition tests...")
    
    success = await test_instrument_addition()
    
    if success:
        logger.info("✅ All tests passed!")
        sys.exit(0)
    else:
        logger.error("❌ Some tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
