"""
CoinGecko data source implementation for cryptocurrency data.
Free API with excellent cryptocurrency coverage.
"""

import asyncio
from datetime import datetime
from typing import Optional
import aiohttp

from .base import BaseDataSource
from ..database.models import PriceData
from ..exceptions import DataSourceError
from ..utils.logger import logger


class CoinGeckoDataSource(BaseDataSource):
    """
    CoinGecko data source for cryptocurrency data.
    
    Features:
    - Free API with no rate limits for basic usage
    - Real-time cryptocurrency prices
    - 24/7 data availability
    - High reliability
    """
    
    BASE_URL = "https://api.coingecko.com/api/v3"
    
    def __init__(self):
        super().__init__("CoinGecko", rate_limit_calls_per_minute=50)  # Conservative limit
        self.session = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if not self.session or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=15)
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers={
                    'User-Agent': 'StockAnomalySystem/1.0'
                }
            )
        return self.session
    
    async def get_price(self, symbol: str) -> Optional[PriceData]:
        """
        Fetch current cryptocurrency price data from CoinGecko.
        
        Args:
            symbol: Cryptocurrency symbol (e.g., 'BTC/USD', 'BTC-USD', 'BTC')
            
        Returns:
            PriceData object with current price information
        """
        try:
            logger.debug(f"Fetching {symbol} from CoinGecko")
            
            # Normalize symbol for CoinGecko API
            coin_id = self._normalize_symbol(symbol)
            if not coin_id:
                raise DataSourceError(f"Unsupported symbol format: {symbol}")
            
            session = await self._get_session()
            url = f"{self.BASE_URL}/simple/price"
            params = {
                'ids': coin_id,
                'vs_currencies': 'usd',
                'include_24hr_change': 'true',
                'include_24hr_vol': 'true',
                'include_market_cap': 'true'
            }
            
            async with session.get(url, params=params) as response:
                if response.status == 429:
                    raise DataSourceError("Rate limit exceeded")
                elif response.status != 200:
                    raise DataSourceError(f"HTTP {response.status}: {await response.text()}")
                
                data = await response.json()
                
                if not data or coin_id not in data:
                    raise DataSourceError(f"Invalid response format for {symbol}")
                
                coin_data = data[coin_id]
                current_price = coin_data.get('usd', 0)
                
                if current_price <= 0:
                    logger.warning(f"CoinGecko returned zero/negative price for {symbol}")
                    return None
                
                # Create PriceData object with current timestamp
                # For crypto, use current time as they trade 24/7
                current_timestamp = datetime.now()
                
                price_data = PriceData(
                    symbol=symbol.upper(),
                    open_price=current_price,  # CoinGecko doesn't provide OHLC in simple endpoint
                    high_price=current_price,
                    low_price=current_price,
                    close_price=current_price,
                    volume=coin_data.get('usd_24h_vol'),
                    timestamp=current_timestamp,
                    source="coingecko",
                    metadata={
                        'price_change_24h': coin_data.get('usd_24h_change'),
                        'price_change_percent_24h': coin_data.get('usd_24h_change'),
                        'market_cap_usd': coin_data.get('usd_market_cap'),
                        'coin_id': coin_id,
                        'ingestion_time': current_timestamp.isoformat()
                    }
                )
                
                logger.debug(f"Successfully fetched {symbol} from CoinGecko: ${current_price}")
                return price_data
                
        except Exception as e:
            logger.debug(f"⚠️  Error fetching {symbol} from CoinGecko: {e} (external API issue)")
            raise DataSourceError(f"CoinGecko fetch failed: {e}")
    
    def _normalize_symbol(self, symbol: str) -> Optional[str]:
        """
        Normalize symbol to CoinGecko coin ID.
        
        Args:
            symbol: Input symbol (e.g., 'BTC/USD', 'BTC-USD', 'BTC')
            
        Returns:
            CoinGecko coin ID or None if not supported
        """
        # Remove common separators and currency suffixes
        clean_symbol = symbol.upper().replace('/', '').replace('-', '').replace('USD', '').replace('USDT', '')
        
        # Map common symbols to CoinGecko IDs
        symbol_mapping = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'ADA': 'cardano',
            'DOT': 'polkadot',
            'LINK': 'chainlink',
            'LTC': 'litecoin',
            'BCH': 'bitcoin-cash',
            'XRP': 'ripple',
            'XLM': 'stellar',
            'EOS': 'eos'
        }
        
        return symbol_mapping.get(clean_symbol)
    
    async def get_historical_prices(self, symbol: str, days: int = 30) -> list:
        """
        Fetch historical cryptocurrency prices.
        
        Args:
            symbol: Cryptocurrency symbol
            days: Number of days of historical data
            
        Returns:
            List of PriceData objects
        """
        try:
            coin_id = self._normalize_symbol(symbol)
            if not coin_id:
                raise DataSourceError(f"Unsupported symbol format: {symbol}")
            
            session = await self._get_session()
            url = f"{self.BASE_URL}/coins/{coin_id}/market_chart"
            params = {
                'vs_currency': 'usd',
                'days': days
            }
            
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    raise DataSourceError(f"HTTP {response.status}: {await response.text()}")
                
                data = await response.json()
                
                if 'prices' not in data:
                    raise DataSourceError(f"Invalid historical data format for {symbol}")
                
                prices = []
                for price_point in data['prices']:
                    timestamp = datetime.fromtimestamp(price_point[0] / 1000)
                    price = price_point[1]
                    
                    price_data = PriceData(
                        symbol=symbol.upper(),
                        open_price=price,
                        high_price=price,
                        low_price=price,
                        close_price=price,
                        volume=None,
                        timestamp=timestamp,
                        source="coingecko",
                        metadata={'historical': True, 'date': timestamp.isoformat()}
                    )
                    prices.append(price_data)
                
                logger.info(f"Fetched {len(prices)} historical prices for {symbol}")
                return prices
                
        except Exception as e:
            logger.debug(f"⚠️  Error fetching historical prices for {symbol} from CoinGecko: {e} (external API issue)")
            raise DataSourceError(f"CoinGecko historical fetch failed: {e}")
    
    def _get_health_check_symbol(self) -> str:
        """
        Override to use BTC for health checks since CoinGecko only supports crypto.
        
        Returns:
            Test symbol string
        """
        logger.info("🔍 CoinGecko health check using BTC symbol")
        return "BTC"
    
    async def health_check(self) -> bool:
        """
        Override health check to be more robust and handle CoinGecko-specific issues.
        """
        logger.debug(f"🧪 Running CoinGecko health check")
        
        try:
            # Test with a simple API call first
            test_symbol = self._get_health_check_symbol()
            logger.info(f"🔍 Testing CoinGecko with {test_symbol} symbol...")
            
            # Try to get a simple price first
            result = await self.get_price(test_symbol)
            
            if result is not None:
                logger.info(f"✅ CoinGecko health check passed")
                return True
            else:
                logger.warning(f"⚠️  CoinGecko health check failed: no data returned")
                return False
                
        except Exception as e:
            logger.debug(f"⚠️  CoinGecko health check failed: {type(e).__name__}: {e} (external API issue)")
            logger.warning(f"⚠️  CoinGecko health check failed, but continuing service startup")
            # Don't crash the service, just return False
            return False
    
    async def close(self):
        """Close the HTTP session."""
        if self.session and not self.session.closed:
            await self.session.close()
            logger.info("CoinGecko session closed")
