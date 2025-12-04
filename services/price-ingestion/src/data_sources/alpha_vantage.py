"""
Alpha Vantage data source implementation.
Official API with good free tier for historical data.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional, List
import aiohttp

from .base import BaseDataSource
from ..database.models import PriceData
from ..exceptions import DataSourceError
from ..utils.logger import logger


class AlphaVantageDataSource(BaseDataSource):
    """
    Alpha Vantage data source for historical stock data.
    
    Features:
    - 25 API calls per day (free tier)
    - Excellent historical data
    - Company fundamentals
    - Official NASDAQ data provider
    """
    
    BASE_URL = "https://www.alphavantage.co/query"
    
    def __init__(self, api_key: str):
        # Very conservative rate limiting (25 calls per day = ~1 per hour)
        super().__init__("AlphaVantage", rate_limit_calls_per_minute=1) 
        self.api_key = api_key
        self.session = None
        logger.info(f"🔑 Alpha Vantage initialized with API key: {'*' * (len(api_key) - 4) + api_key[-4:] if len(api_key) > 4 else '***'}")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if not self.session or self.session.closed:
            logger.debug("🔌 Creating new Alpha Vantage HTTP session")
            timeout = aiohttp.ClientTimeout(total=30)  # Alpha Vantage can be slow
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers={'User-Agent': 'StockAnomalySystem/1.0'}
            )
            logger.debug("✅ Alpha Vantage HTTP session created")
        else:
            logger.debug("🔌 Using existing Alpha Vantage HTTP session")
        return self.session
    
    async def get_price(self, symbol: str) -> Optional[PriceData]:
        """
        Fetch current price data from Alpha Vantage.
        Uses GLOBAL_QUOTE function for real-time data.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            PriceData object with current price information
        """
        logger.info(f"📡 Fetching {symbol} from Alpha Vantage")
        
        try:
            session = await self._get_session()
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': symbol,
                'apikey': self.api_key
            }
            
            logger.debug(f"🔗 Alpha Vantage request URL: {self.BASE_URL}")
            logger.debug(f"📋 Alpha Vantage request params: function={params['function']}, symbol={params['symbol']}")
            
            async with session.get(self.BASE_URL, params=params) as response:
                logger.debug(f"📡 Alpha Vantage response status: {response.status}")
                
                if response.status != 200:
                    error_msg = f"HTTP {response.status}"
                    logger.debug(f"⚠️  Alpha Vantage HTTP error: {error_msg} (external API issue)")
                    raise DataSourceError(error_msg)
                
                data = await response.json()
                logger.debug(f"📊 Alpha Vantage response received: {len(str(data))} characters")
                
                # Check for API limit message
                if 'Note' in data:
                    error_msg = "API rate limit reached"
                    logger.warning(f"⏳ Alpha Vantage {error_msg}: {data['Note']}")
                    raise DataSourceError(error_msg)
                
                if 'Error Message' in data:
                    error_msg = f"API error: {data['Error Message']}"
                    logger.debug(f"⚠️  Alpha Vantage {error_msg} (external API issue)")
                    raise DataSourceError(error_msg)
                
                quote_data = data.get('Global Quote', {})
                if not quote_data:
                    error_msg = f"No quote data for {symbol}"
                    logger.warning(f"⚠️  Alpha Vantage {error_msg}")
                    logger.debug(f"🔍 Alpha Vantage response data: {data}")
                    raise DataSourceError(error_msg)
                
                logger.debug(f"📊 Alpha Vantage quote data for {symbol}: {quote_data}")
                
                # Parse Alpha Vantage response format
                # Use the latest trading day as the timestamp if available
                market_timestamp = None
                latest_trading_day = quote_data.get('07. latest trading day')
                if latest_trading_day:
                    try:
                        market_timestamp = datetime.strptime(latest_trading_day, '%Y-%m-%d')
                        logger.debug(f"📅 Using latest trading day for {symbol}: {market_timestamp}")
                    except Exception as e:
                        logger.warning(f"⚠️  Failed to parse latest trading day for {symbol}: {e}")
                        market_timestamp = datetime.now()
                else:
                    market_timestamp = datetime.now()
                
                price_data = PriceData(
                    symbol=symbol.upper(),
                    open_price=self._safe_float(quote_data.get('02. open')),
                    high_price=self._safe_float(quote_data.get('03. high')),
                    low_price=self._safe_float(quote_data.get('04. low')),
                    close_price=self._safe_float(quote_data.get('05. price')),
                    volume=self._safe_int(quote_data.get('06. volume')),
                    timestamp=market_timestamp,
                    source="alpha_vantage",
                    metadata={
                        'previous_close': self._safe_float(quote_data.get('08. previous close')),
                        'change': self._safe_float(quote_data.get('09. change')),
                        'change_percent': quote_data.get('10. change percent', '').rstrip('%'),
                        'latest_trading_day': latest_trading_day
                    }
                )
                
                logger.info(f"✅ Successfully fetched {symbol} from Alpha Vantage: ${price_data.close_price}")
                logger.debug(f"📊 Parsed price data: Open=${price_data.open_price}, High=${price_data.high_price}, Low=${price_data.low_price}, Volume={price_data.volume}")
                return price_data
                
        except aiohttp.ClientError as e:
            error_msg = f"Alpha Vantage network error: {e}"
            logger.debug(f"⚠️  {error_msg} (external API network issue)")
            raise DataSourceError(error_msg)
        except Exception as e:
            error_msg = f"Alpha Vantage error: {e}"
            logger.debug(f"⚠️  {error_msg} (external API issue)")
            logger.debug(f"🔍 Alpha Vantage error details: {type(e).__name__}: {str(e)}")
            raise DataSourceError(error_msg)
    
    async def get_historical_data(self, symbol: str, days: int = 100) -> List[PriceData]:
        """
        Fetch historical data from Alpha Vantage.
        Uses TIME_SERIES_DAILY function.
        
        Args:
            symbol: Stock symbol
            days: Number of days (not used directly, Alpha Vantage returns what it has)
            
        Returns:
            List of PriceData objects
        """
        logger.info(f"📚 Fetching historical data for {symbol} from Alpha Vantage (requested: {days} days)")
        
        try:
            session = await self._get_session()
            
            # Use compact for less data, or full for complete history
            output_size = "compact" if days <= 100 else "full"
            logger.debug(f"📊 Alpha Vantage output size: {output_size}")
            
            params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': symbol,
                'outputsize': output_size,
                'apikey': self.api_key
            }
            
            logger.debug(f"🔗 Alpha Vantage historical request URL: {self.BASE_URL}")
            logger.debug(f"📋 Alpha Vantage historical request params: function={params['function']}, symbol={params['symbol']}, outputsize={params['outputsize']}")
            
            async with session.get(self.BASE_URL, params=params) as response:
                logger.debug(f"📡 Alpha Vantage historical response status: {response.status}")
                
                if response.status != 200:
                    error_msg = f"HTTP {response.status}"
                    logger.debug(f"⚠️  Alpha Vantage historical HTTP error: {error_msg} (external API issue)")
                    raise DataSourceError(error_msg)
                
                data = await response.json()
                logger.debug(f"📊 Alpha Vantage historical response received: {len(str(data))} characters")
                
                # Check for errors
                if 'Note' in data:
                    error_msg = "API rate limit reached"
                    logger.warning(f"⏳ Alpha Vantage historical {error_msg}: {data['Note']}")
                    raise DataSourceError(error_msg)
                
                if 'Error Message' in data:
                    error_msg = f"API error: {data['Error Message']}"
                    logger.debug(f"⚠️  Alpha Vantage historical {error_msg} (external API issue)")
                    raise DataSourceError(error_msg)
                
                time_series = data.get('Time Series (Daily)', {})
                if not time_series:
                    logger.warning(f"⚠️  Alpha Vantage no historical data for {symbol}")
                    logger.debug(f"🔍 Alpha Vantage historical response data: {data}")
                    return []
                
                logger.info(f"📊 Alpha Vantage returned {len(time_series)} daily data points for {symbol}")
                
                historical_prices = []
                cutoff_date = datetime.now() - timedelta(days=days)
                logger.debug(f"📅 Historical data cutoff date: {cutoff_date.date()}")
                
                for date_str, price_info in time_series.items():
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                        
                        # Filter by requested days
                        if date_obj < cutoff_date:
                            logger.debug(f"⏰ Skipping {date_str} (before cutoff date)")
                            continue
                        
                        price_data = PriceData(
                            symbol=symbol.upper(),
                            open_price=self._safe_float(price_info.get('1. open')),
                            high_price=self._safe_float(price_info.get('2. high')),
                            low_price=self._safe_float(price_info.get('3. low')),
                            close_price=self._safe_float(price_info.get('4. close')),
                            volume=self._safe_int(price_info.get('5. volume')),
                            timestamp=date_obj,
                            source="alpha_vantage",
                            metadata={
                                'historical': True,
                                'date': date_str
                            }
                        )
                        
                        historical_prices.append(price_data)
                        logger.debug(f"✅ Parsed historical data for {symbol} on {date_str}: Close=${price_data.close_price}")
                        
                    except Exception as e:
                        logger.warning(f"⚠️  Failed to parse historical data point for {symbol} on {date_str}: {e}")
                        continue
                
                # Sort by date (oldest first)
                historical_prices.sort(key=lambda x: x.timestamp)
                
                logger.info(f"✅ Successfully parsed {len(historical_prices)} historical data points for {symbol}")
                return historical_prices
                
        except Exception as e:
            error_msg = f"Alpha Vantage historical error: {e}"
            logger.debug(f"⚠️  {error_msg} (external API issue)")
            logger.debug(f"🔍 Alpha Vantage historical error details: {type(e).__name__}: {str(e)}")
            raise DataSourceError(error_msg)
    
    def _safe_float(self, value) -> Optional[float]:
        """Safely convert string to float."""
        try:
            if value is None or value == '':
                logger.debug(f"⚠️  Empty value for float conversion: {value}")
                return None
            
            result = float(value)
            logger.debug(f"✅ Float conversion successful: {value} -> {result}")
            return result
            
        except (ValueError, TypeError) as e:
            logger.warning(f"⚠️  Float conversion failed for '{value}': {e}")
            return None
    
    def _safe_int(self, value) -> Optional[int]:
        """Safely convert string to int."""
        try:
            if value is None or value == '':
                logger.debug(f"⚠️  Empty value for int conversion: {value}")
                return None
            
            result = int(float(value))
            logger.debug(f"✅ Int conversion successful: {value} -> {result}")
            return result
            
        except (ValueError, TypeError) as e:
            logger.warning(f"⚠️  Int conversion failed for '{value}': {e}")
            return None
    
    async def health_check(self) -> bool:
        """Check if Alpha Vantage API is accessible."""
        logger.debug("🧪 Running Alpha Vantage health check...")
        
        try:
            # Use SPY (from our tracked symbols) for health check instead of IBM
            test_symbol = "SPY"
            logger.debug(f"🔍 Testing Alpha Vantage with {test_symbol} symbol...")
            result = await self.get_price(test_symbol)
            
            if result is not None:
                logger.info("✅ Alpha Vantage health check passed")
                return True
            else:
                logger.debug("⚠️  Alpha Vantage health check failed: no data returned (this is normal)")
                return False
                
        except Exception as e:
            logger.debug(f"⚠️  Alpha Vantage health check failed: {type(e).__name__}: {e} (this is normal)")
            return False
    
    async def close(self):
        """Close HTTP session."""
        if self.session and not self.session.closed:
            logger.debug("🔌 Closing Alpha Vantage HTTP session...")
            await self.session.close()
            logger.info("✅ Alpha Vantage session closed")
        else:
            logger.debug("⚠️  Alpha Vantage session already closed or not initialized")