#!/usr/bin/env python3
"""
Test script for the startup data initialization feature.
This script tests the current implementation to see what's working.
"""

import sys
from pathlib import Path

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

async def test_startup_feature():
    """Test the startup data initialization feature."""
    print("🧪 Testing startup data initialization feature...")
    
    try:
        # Import the ingester
        from src.ingester import PriceIngester
        print("✅ PriceIngester imported successfully")
        
        # Create instance
        ingester = PriceIngester()
        print("✅ PriceIngester instance created successfully")
        
        # Check if the startup data method exists
        if hasattr(ingester, '_initialize_startup_data'):
            print("✅ _initialize_startup_data method exists")
            
            # Check method signature
            import inspect
            sig = inspect.signature(ingester._initialize_startup_data)
            print(f"📋 Method signature: {sig}")
            
            # Check if it's async
            if inspect.iscoroutinefunction(ingester._initialize_startup_data):
                print("✅ Method is async (correct)")
            else:
                print("❌ Method is not async (should be async)")
                
        else:
            print("❌ _initialize_startup_data method does not exist")
        
        # Check for other required methods
        required_methods = [
            '_check_recent_data_exists',
            '_populate_startup_historical_data', 
            '_get_best_historical_source'
        ]
        
        for method_name in required_methods:
            if hasattr(ingester, method_name):
                print(f"✅ {method_name} method exists")
            else:
                print(f"❌ {method_name} method missing")
        
        print("\n📊 Current Implementation Status:")
        print("================================")
        
        # Check what's currently implemented
        current_methods = [method for method in dir(ingester) if method.startswith('_') and 'startup' in method.lower()]
        if current_methods:
            print(f"✅ Found startup-related methods: {current_methods}")
        else:
            print("❌ No startup-related methods found")
        
        # Check what's missing
        missing_methods = [method for method in required_methods if not hasattr(ingester, method)]
        if missing_methods:
            print(f"❌ Missing methods: {missing_methods}")
        else:
            print("✅ All required methods are present")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function."""
    print("🚀 Starting startup feature test...")
    
    try:
        import asyncio
        success = asyncio.run(test_startup_feature())
        
        if success:
            print("\n🎉 Test completed successfully!")
            print("\n📋 Summary:")
            print("The current implementation has a basic startup data initialization method,")
            print("but it's missing the comprehensive historical data population feature.")
            print("\nTo implement the full feature, you need to:")
            print("1. Replace the current _initialize_startup_data method")
            print("2. Add the missing helper methods")
            print("3. Test with an empty database")
        else:
            print("\n💥 Test failed!")
            sys.exit(1)
            
    except Exception as e:
        print(f"💥 Fatal error: {type(e).__name__}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
