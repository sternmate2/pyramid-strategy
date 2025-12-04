"""
Redis cache management for the price ingestion service.
"""

import json
import redis.asyncio as redis
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from .config import config
from .logger import logger
from ..database.models import PriceData
from ..exceptions import CacheError


class CacheManager:
    """
    Manages Redis cache for price data and rate limiting.
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.stats = {
            'cache_hits': 0,
            'cache_misses': 0,
            'cache_sets': 0,
            'cache_errors': 0
        }
    
    async def initialize(self):
        """Initialize Redis connection."""
        try:
            logger.info("Initializing Redis cache connection...")
            
            self.redis_client = redis.from_url(
                config.redis_url,
                encoding='utf-8',
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                max_connections=10
            )
            
            # Test connection
            await self.redis_client.ping()
            
            logger.info("Redis cache connection established successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis cache: {e}")
            raise CacheError(f"Cache initialization failed: {e}")
    
    async def get_price(self, symbol: str) -> Optional[Dict]:
        """
        Get cached price data for a symbol.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Dictionary with price data if cached, None otherwise
        """
        try:
            key = f"price:{symbol.upper()}:latest"
            cached_data = await self.redis_client.get(key)
            
            if cached_data:
                self.stats['cache_hits'] += 1
                return json.loads(cached_data)
            else:
                self.stats['cache_misses'] += 1
                return None
                
        except Exception as e:
            self.stats['cache_errors'] += 1
            logger.warning(f"Cache get error for {symbol}: {e}")
            return None
    
    async def set_price(self, symbol: str, price_data: PriceData, ttl_seconds: int = 900):
        """
        Cache price data for a symbol.
        
        Args:
            symbol: Stock symbol
            price_data: PriceData object to cache
            ttl_seconds: Time to live in seconds (default: 15 minutes)
        """
        try:
            key = f"price:{symbol.upper()}:latest"
            data = price_data.to_dict()
            
            await self.redis_client.setex(
                key,
                ttl_seconds,
                json.dumps(data, default=str)
            )
            
            self.stats['cache_sets'] += 1
            logger.debug(f"Cached price data for {symbol} (TTL: {ttl_seconds}s)")
            
        except Exception as e:
            self.stats['cache_errors'] += 1
            logger.warning(f"Cache set error for {symbol}: {e}")
    
    async def get_historical_prices(self, symbol: str, days: int = 30) -> Optional[Dict]:
        """Get cached historical price data."""
        try:
            key = f"price:{symbol.upper()}:historical:{days}d"
            cached_data = await self.redis_client.get(key)
            
            if cached_data:
                self.stats['cache_hits'] += 1
                return json.loads(cached_data)
            else:
                self.stats['cache_misses'] += 1
                return None
                
        except Exception as e:
            self.stats['cache_errors'] += 1
            logger.warning(f"Historical cache get error for {symbol}: {e}")
            return None
    
    async def set_historical_prices(self, symbol: str, historical_data: list, 
                                  days: int = 30, ttl_seconds: int = 3600):
        """Cache historical price data."""
        try:
            key = f"price:{symbol.upper()}:historical:{days}d"
            data = [item.to_dict() if hasattr(item, 'to_dict') else item 
                   for item in historical_data]
            
            await self.redis_client.setex(
                key,
                ttl_seconds,
                json.dumps(data, default=str)
            )
            
            self.stats['cache_sets'] += 1
            logger.debug(f"Cached {len(data)} historical prices for {symbol}")
            
        except Exception as e:
            self.stats['cache_errors'] += 1
            logger.warning(f"Historical cache set error for {symbol}: {e}")
    
    async def check_rate_limit(self, source: str, limit_per_minute: int) -> bool:
        """
        Check if a data source is within rate limits.
        
        Args:
            source: Data source name (e.g., 'finnhub', 'yahoo')
            limit_per_minute: Maximum requests per minute
            
        Returns:
            True if within limits, False if rate limited
        """
        try:
            key = f"rate_limit:{source}:minute"
            current_count = await self.redis_client.get(key)
            
            if current_count is None:
                # First request in this minute
                await self.redis_client.setex(key, 60, 1)
                return True
            elif int(current_count) < limit_per_minute:
                # Within limits, increment counter
                await self.redis_client.incr(key)
                return True
            else:
                # Rate limited
                return False
                
        except Exception as e:
            logger.warning(f"Rate limit check error for {source}: {e}")
            # On error, allow the request (fail open)
            return True
    
    async def record_rate_limit_usage(self, source: str):
        """Record that a rate limited API was used."""
        try:
            key = f"rate_limit:{source}:minute"
            
            # Get current count or start at 0
            current_count = await self.redis_client.get(key)
            
            if current_count is None:
                await self.redis_client.setex(key, 60, 1)
            else:
                await self.redis_client.incr(key)
                
        except Exception as e:
            logger.warning(f"Rate limit recording error for {source}: {e}")
    
    async def get_ingestion_lock(self, lock_key: str, ttl_seconds: int = 300) -> bool:
        """
        Acquire a distributed lock for ingestion operations.
        
        Args:
            lock_key: Unique key for the lock
            ttl_seconds: Lock timeout in seconds
            
        Returns:
            True if lock acquired, False if already locked
        """
        try:
            key = f"lock:ingestion:{lock_key}"
            result = await self.redis_client.set(key, "locked", ex=ttl_seconds, nx=True)
            return result is not None
            
        except Exception as e:
            logger.warning(f"Lock acquisition error for {lock_key}: {e}")
            return True  # Fail open
    
    async def release_ingestion_lock(self, lock_key: str):
        """Release a distributed lock."""
        try:
            key = f"lock:ingestion:{lock_key}"
            await self.redis_client.delete(key)
            
        except Exception as e:
            logger.warning(f"Lock release error for {lock_key}: {e}")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.redis_client:
            return {'status': 'disconnected'}
        
        try:
            # Get Redis info
            info = await self.redis_client.info()
            
            return {
                'status': 'connected',
                'redis_version': info.get('redis_version'),
                'connected_clients': info.get('connected_clients'),
                'used_memory_human': info.get('used_memory_human'),
                'keyspace_hits': info.get('keyspace_hits'),
                'keyspace_misses': info.get('keyspace_misses'),
                **self.stats
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
                **self.stats
            }
    
    async def clear_cache(self, pattern: str = "price:*"):
        """Clear cached data matching pattern."""
        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                await self.redis_client.delete(*keys)
                logger.info(f"Cleared {len(keys)} cache entries matching '{pattern}'")
            
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
    
    async def close(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
            self.redis_client = None
            logger.info("Redis cache connection closed")