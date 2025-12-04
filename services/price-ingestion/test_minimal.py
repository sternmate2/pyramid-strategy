#!/usr/bin/env python3
"""
Minimal test script to isolate circular dependency issues.
"""

import sys
from pathlib import Path

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

def test_config_only():
    """Test only config import."""
    print("📋 Testing config import only...")
    
    try:
        from src.utils.config import config
        print(f"✅ Config imported successfully: {config.ENVIRONMENT}")
        print(f"📊 Tracked symbols: {config.TRACKED_SYMBOLS}")
        return True
    except Exception as e:
        print(f"❌ Config import failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_logger_only():
    """Test only logger import."""
    print("📝 Testing logger import only...")
    
    try:
        from src.utils.logger import logger
        print("✅ Logger imported successfully")
        return True
    except Exception as e:
        print(f"❌ Logger import failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function."""
    print("🚀 Starting minimal import tests...")
    
    success = True
    
    # Test config import
    if not test_config_only():
        success = False
    
    # Test logger import
    if not test_logger_only():
        success = False
    
    if success:
        print("🎉 Minimal tests passed!")
    else:
        print("💥 Minimal tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
