"""
Base data source class defining the interface for all data sources.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import asyncio

from ..database.models import PriceData
from ..exceptions import DataSourceError
from ..utils.logger import logger


class RateLimiter:
    """Simple rate limiter for API calls."""
    
    def __init__(self, calls_per_minute: int):
        self.calls_per_minute = calls_per_minute
        self.calls = []
        self.lock = asyncio.Lock()
        logger.debug(f"RateLimiter initialized: {calls_per_minute} calls per minute")
    
    async def can_make_request(self) -> bool:
        """Check if we can make a request without exceeding rate limits."""
        async with self.lock:
            now = datetime.now()
            # Remove calls older than 1 minute
            old_calls = [call_time for call_time in self.calls 
                         if now - call_time >= timedelta(minutes=1)]
            if old_calls:
                logger.debug(f"🧹 Removed {len(old_calls)} old rate limit records")
            
            self.calls = [call_time for call_time in self.calls 
                         if now - call_time < timedelta(minutes=1)]
            
            can_make = len(self.calls) < self.calls_per_minute
            logger.debug(f"📊 Rate limit check: {len(self.calls)}/{self.calls_per_minute} calls used, can_make: {can_make}")
            
            return can_make
    
    async def record_request(self):
        """Record that a request was made."""
        async with self.lock:
            now = datetime.now()
            self.calls.append(now)
            logger.debug(f"📝 Recorded API request at {now.strftime('%H:%M:%S')}, total calls: {len(self.calls)}")


class BaseDataSource(ABC):
    """
    Abstract base class for all data sources.
    Defines the interface that all data sources must implement.
    """
    
    def __init__(self, name: str, rate_limit_calls_per_minute: int = 60):
        self.name = name
        self.rate_limiter = RateLimiter(rate_limit_calls_per_minute)
        self.stats = {
            'requests_made': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'last_request_time': None,
            'last_error': None
        }
        logger.info(f"🔧 {self.name} data source initialized with rate limit: {rate_limit_calls_per_minute} calls/minute")
    
    @abstractmethod
    async def get_price(self, symbol: str) -> Optional[PriceData]:
        """
        Fetch current price data for a symbol.
        
        Args:
            symbol: Stock symbol (e.g., 'AAPL', 'SPY')
            
        Returns:
            PriceData object if successful, None if failed
            
        Raises:
            DataSourceError: If there's an error fetching data
        """
        pass
    
    async def get_historical_data(self, symbol: str, days: int = 30) -> List[PriceData]:
        """
        Fetch historical price data for a symbol.
        Default implementation returns empty list - override if supported.
        
        Args:
            symbol: Stock symbol
            days: Number of days of historical data
            
        Returns:
            List of PriceData objects
        """
        logger.debug(f"📚 {self.name} does not support historical data for {symbol}")
        return []
    
    async def can_make_request(self) -> bool:
        """Check if we can make a request within rate limits."""
        can_make = await self.rate_limiter.can_make_request()
        if not can_make:
            logger.warning(f"⏳ {self.name} rate limited, cannot make request")
        return can_make
    
    async def health_check(self) -> bool:
        """
        Check if the data source is available and working.
        Default implementation tries to fetch a test symbol.
        
        Returns:
            True if healthy, False otherwise
        """
        logger.debug(f"🧪 Running health check for {self.name}")
        
        try:
            # Select appropriate test symbol based on data source type
            test_symbol = self._get_health_check_symbol()
            logger.info(f"🔍 Testing {self.name} with {test_symbol} symbol...")
            
            result = await self.get_price(test_symbol)
            
            if result is not None:
                logger.info(f"✅ {self.name} health check passed")
                return True
            else:
                logger.warning(f"⚠️  {self.name} health check failed: no data returned")
                return False
                
        except Exception as e:
            logger.debug(f"⚠️  {self.name} health check failed: {type(e).__name__}: {e} (external API issue)")
            return False
    
    def _get_health_check_symbol(self) -> str:
        """
        Get the appropriate test symbol for health checks.
        Override in subclasses to use different symbols.
        
        Returns:
            Test symbol string
        """
        return "SPY"  # Default for stock-focused data sources
    
    def _update_stats(self, success: bool, error: Optional[str] = None):
        """Update internal statistics."""
        self.stats['requests_made'] += 1
        self.stats['last_request_time'] = datetime.now().isoformat()
        
        if success:
            self.stats['successful_requests'] += 1
            logger.debug(f"📊 {self.name} stats updated: successful request (total: {self.stats['successful_requests']})")
        else:
            self.stats['failed_requests'] += 1
            if error:
                self.stats['last_error'] = error
            logger.debug(f"📊 {self.name} stats updated: failed request (total: {self.stats['failed_requests']})")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get statistics for this data source."""
        success_rate = (
            self.stats['successful_requests'] / max(self.stats['requests_made'], 1) * 100
        )
        
        stats = {
            'name': self.name,
            **self.stats,
            'success_rate': success_rate
        }
        
        logger.debug(f"📊 {self.name} stats: {stats}")
        return stats
    
    async def _make_request(self, request_func, *args, **kwargs):
        """
        Wrapper for making requests with rate limiting and stats tracking.
        
        Args:
            request_func: The actual request function to call
            *args, **kwargs: Arguments to pass to request_func
            
        Returns:
            Result of request_func
            
        Raises:
            DataSourceError: If rate limited or request fails
        """
        if not await self.can_make_request():
            error_msg = f"{self.name}: Rate limit exceeded"
            logger.warning(f"⏳ {error_msg}")
            raise DataSourceError(error_msg)
        
        try:
            logger.debug(f"📡 {self.name} making request...")
            await self.rate_limiter.record_request()
            
            result = await request_func(*args, **kwargs)
            self._update_stats(success=True)
            
            logger.debug(f"✅ {self.name} request successful")
            return result
            
        except Exception as e:
            error_msg = f"{self.name}: Request failed - {str(e)}"
            # Log external API failures as debug, not error (they're expected)
            logger.debug(f"⚠️  {error_msg} (external API failure - normal)")
            self._update_stats(success=False, error=error_msg)
            raise DataSourceError(error_msg)
    
    def __str__(self):
        return f"{self.name}DataSource"
    
    def __repr__(self):
        return f"{self.__class__.__name__}(name='{self.name}')"