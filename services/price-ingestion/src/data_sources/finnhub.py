"""
Finnhub data source implementation.
Official API with excellent free tier (60 calls/minute).
"""

import asyncio
from datetime import datetime
from typing import Optional
import aiohttp

from .base import BaseDataSource
from ..database.models import PriceData
from ..exceptions import DataSourceError
from ..utils.logger import logger


class FinnhubDataSource(BaseDataSource):
    """
    Finnhub data source for real-time stock data.
    
    Features:
    - 60 API calls per minute (free tier)
    - Real-time price data
    - Company fundamentals
    - High reliability
    """
    
    BASE_URL = "https://finnhub.io/api/v1"
    
    def __init__(self, api_key: str):
        super().__init__("Finnhub", rate_limit_calls_per_minute=58)  # Slightly under limit
        self.api_key = api_key
        self.session = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=10)
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers={
                    'X-Finnhub-Token': self.api_key,
                    'User-Agent': 'StockAnomalySystem/1.0'
                }
            )
        return self.session
    
    async def get_price(self, symbol: str) -> Optional[PriceData]:
        """
        Fetch current price data from Finnhub.
        
        Args:
            symbol: Stock symbol (e.g., 'AAPL')
            
        Returns:
            PriceData object with current price information
        """
        try:
            logger.debug(f"Fetching {symbol} from Finnhub")
            
            session = await self._get_session()
            url = f"{self.BASE_URL}/quote"
            params = {'symbol': symbol}
            
            async with session.get(url, params=params) as response:
                if response.status == 429:
                    raise DataSourceError("Rate limit exceeded")
                elif response.status != 200:
                    raise DataSourceError(f"HTTP {response.status}: {await response.text()}")
                
                data = await response.json()
                
                # Finnhub returns real-time quote data
                if not data or 'c' not in data:
                    raise DataSourceError(f"Invalid response format for {symbol}")
                
                # Check if market is closed (price might be 0)
                current_price = data.get('c', 0)
                if current_price <= 0:
                    logger.warning(f"Finnhub returned zero/negative price for {symbol}")
                    return None
                
                # Create PriceData object with actual market timestamp
                # Finnhub timestamp 't' is Unix timestamp in seconds
                market_timestamp = None
                if data.get('t'):
                    try:
                        market_timestamp = datetime.fromtimestamp(data.get('t'))
                        logger.debug(f"📅 Using market timestamp for {symbol}: {market_timestamp}")
                    except Exception as e:
                        logger.warning(f"⚠️  Failed to parse market timestamp for {symbol}: {e}")
                        market_timestamp = datetime.now()
                else:
                    market_timestamp = datetime.now()
                
                price_data = PriceData(
                    symbol=symbol.upper(),
                    open_price=data.get('o'),
                    high_price=data.get('h'),  
                    low_price=data.get('l'),
                    close_price=current_price,
                    volume=None,  # Real-time quotes don't include volume
                    timestamp=market_timestamp,
                    source="finnhub",
                    metadata={
                        'previous_close': data.get('pc'),
                        'change': data.get('d'),
                        'percent_change': data.get('dp'),
                        'timestamp': data.get('t')
                    }
                )
                
                logger.debug(f"Successfully fetched {symbol} from Finnhub: ${current_price}")
                return price_data
                
        except aiohttp.ClientError as e:
            raise DataSourceError(f"Finnhub network error: {e}")
        except Exception as e:
            raise DataSourceError(f"Finnhub error: {e}")
    
    async def get_company_profile(self, symbol: str) -> Optional[dict]:
        """
        Fetch company profile data from Finnhub.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Dictionary with company information
        """
        try:
            session = await self._get_session()
            url = f"{self.BASE_URL}/stock/profile2"
            params = {'symbol': symbol}
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    return await response.json()
                return None
                
        except Exception as e:
            logger.warning(f"Failed to fetch company profile for {symbol}: {e}")
            return None
    
    async def health_check(self) -> bool:
        """Check if Finnhub API is accessible."""
        try:
            # Try to fetch a popular stock
            result = await self.get_price("AAPL")
            return result is not None
        except Exception as e:
            logger.warning(f"Finnhub health check failed: {e}")
            return False
    
    async def close(self):
        """Close HTTP session."""
        if self.session and not self.session.closed:
            await self.session.close()
            logger.debug("Finnhub session closed")