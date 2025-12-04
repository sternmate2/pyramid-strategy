#!/usr/bin/env python3
"""
Simple test script to verify basic imports and logging are working.
"""

import sys
from pathlib import Path

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

def test_basic_imports():
    """Test basic imports without circular dependencies."""
    print("🧪 Testing basic imports...")
    
    try:
        # Test config import
        print("📋 Testing config import...")
        from src.utils.config import config
        print(f"✅ Config imported successfully: {config.ENVIRONMENT}")
        print(f"📊 Tracked symbols: {config.TRACKED_SYMBOLS}")
        
        # Test logger import
        print("📝 Testing logger import...")
        from src.utils.logger import logger
        print("✅ Logger imported successfully")
        
        # Test basic logging
        print("🔍 Testing basic logging...")
        logger.info("ℹ️  This is a test info message")
        logger.warning("⚠️  This is a test warning message")
        logger.error("❌ This is a test error message")
        print("✅ Basic logging test completed")
        
        return True
        
    except Exception as e:
        print(f"❌ Import test failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_ingester_import():
    """Test ingester import."""
    print("🔧 Testing ingester import...")
    
    try:
        from src.ingester import PriceIngester
        print("✅ Ingester imported successfully")
        
        # Create instance (without initializing)
        ingester = PriceIngester()
        print("✅ Ingester instance created successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Ingester import test failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function."""
    print("🚀 Starting simple import tests...")
    
    success = True
    
    # Test basic imports
    if not test_basic_imports():
        success = False
    
    # Test ingester import
    if not test_ingester_import():
        success = False
    
    if success:
        print("🎉 All tests passed!")
    else:
        print("💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
