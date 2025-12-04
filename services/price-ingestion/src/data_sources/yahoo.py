"""
Yahoo Finance data source implementation using yfinance library.
Unofficial but popular and reliable through yfinance wrapper.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional, List
import yfinance as yf
import pandas as pd

from .base import BaseDataSource
from ..database.models import PriceData
from ..exceptions import DataSourceError
from ..utils.logger import logger


class YahooDataSource(BaseDataSource):
    """
    Yahoo Finance data source using yfinance library.
    
    Features:
    - Free access (no API key required)
    - Comprehensive data (price, volume, fundamentals)
    - Historical data support
    - Unofficial but widely used
    
    Note: This is an unofficial API that may be rate limited or blocked.
    """
    
    def __init__(self):
        # Conservative rate limiting to avoid blocks
        super().__init__("Yahoo", rate_limit_calls_per_minute=30)
    
    async def get_price(self, symbol: str) -> Optional[PriceData]:
        """
        Fetch current price data using yfinance.
        
        Args:
            symbol: Stock symbol (e.g., 'AAPL')
            
        Returns:
            PriceData object with current price information
        """
        try:
            logger.debug(f"Fetching {symbol} from Yahoo Finance")
            
            # Run yfinance in thread pool to avoid blocking
            ticker = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: yf.Ticker(symbol)
            )
            
            # Get latest data (1 day with 1 minute intervals for most recent)
            hist_data = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: ticker.history(period="1d", interval="1m", timeout=10)
            )
            
            if hist_data.empty:
                logger.warning(f"No data returned from Yahoo for {symbol}")
                return None
            
            # Get the most recent data point
            latest = hist_data.tail(1).iloc[0]
            
            # Get basic info for volume (if available)
            try:
                info = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: ticker.info
                )
                volume = info.get('volume')
            except:
                volume = int(latest['Volume']) if 'Volume' in latest and pd.notna(latest['Volume']) else None
            
            # Create PriceData object with actual market timestamp
            # Use the data timestamp from Yahoo Finance if available
            market_timestamp = None
            if hasattr(latest.name, 'to_pydatetime'):
                market_timestamp = latest.name.to_pydatetime()
                logger.debug(f"📅 Using Yahoo market timestamp for {symbol}: {market_timestamp}")
            elif hasattr(latest.name, 'isoformat'):
                try:
                    market_timestamp = datetime.fromisoformat(latest.name.isoformat())
                    logger.debug(f"📅 Using Yahoo ISO timestamp for {symbol}: {market_timestamp}")
                except Exception as e:
                    logger.warning(f"⚠️  Failed to parse Yahoo ISO timestamp for {symbol}: {e}")
                    market_timestamp = datetime.now()
            else:
                market_timestamp = datetime.now()
            
            price_data = PriceData(
                symbol=symbol.upper(),
                open_price=float(latest['Open']) if pd.notna(latest['Open']) else None,
                high_price=float(latest['High']) if pd.notna(latest['High']) else None,
                low_price=float(latest['Low']) if pd.notna(latest['Low']) else None,
                close_price=float(latest['Close']) if pd.notna(latest['Close']) else None,
                volume=volume,
                timestamp=market_timestamp,
                source="yahoo",
                metadata={
                    'data_timestamp': latest.name.isoformat() if hasattr(latest.name, 'isoformat') else str(latest.name),
                    'period': '1d',
                    'interval': '1m'
                }
            )
            
            logger.debug(f"Successfully fetched {symbol} from Yahoo: ${price_data.close_price}")
            return price_data
            
        except Exception as e:
            # Yahoo Finance can be temperamental, log but don't raise
            logger.warning(f"Yahoo Finance failed for {symbol}: {e}")
            raise DataSourceError(f"Yahoo Finance error: {e}")
    
    async def get_historical_data(self, symbol: str, days: int = 30) -> List[PriceData]:
        """
        Fetch historical data using yfinance.
        
        Args:
            symbol: Stock symbol
            days: Number of days of historical data
            
        Returns:
            List of PriceData objects
        """
        try:
            logger.info(f"Fetching {days} days of historical data for {symbol} from Yahoo")
            
            ticker = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: yf.Ticker(symbol)
            )
            
            # Calculate period string
            if days <= 5:
                period = "5d"
            elif days <= 30:
                period = "1mo"
            elif days <= 90:
                period = "3mo"
            elif days <= 180:
                period = "6mo"
            else:
                period = "1y"
            
            hist_data = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: ticker.history(period=period, timeout=30)
            )
            
            if hist_data.empty:
                return []
            
            historical_prices = []
            
            for date, row in hist_data.iterrows():
                try:
                    price_data = PriceData(
                        symbol=symbol.upper(),
                        open_price=float(row['Open']) if pd.notna(row['Open']) else None,
                        high_price=float(row['High']) if pd.notna(row['High']) else None,
                        low_price=float(row['Low']) if pd.notna(row['Low']) else None,
                        close_price=float(row['Close']) if pd.notna(row['Close']) else None,
                        volume=int(row['Volume']) if pd.notna(row['Volume']) else None,
                        timestamp=date.to_pydatetime() if hasattr(date, 'to_pydatetime') else date,
                        source="yahoo",
                        metadata={
                            'period': period,
                            'historical': True
                        }
                    )
                    historical_prices.append(price_data)
                except Exception as e:
                    logger.debug(f"Failed to process historical data point for {symbol}: {e}")
                    continue
            
            logger.info(f"Fetched {len(historical_prices)} historical data points for {symbol}")
            return historical_prices
            
        except Exception as e:
            logger.debug(f"⚠️  Failed to fetch historical data for {symbol}: {e} (external API issue)")
            raise DataSourceError(f"Yahoo historical data error: {e}")
    
    async def health_check(self) -> bool:
        """Check if Yahoo Finance is accessible."""
        try:
            # Try to fetch a popular stock with short timeout
            ticker = yf.Ticker("SPY")
            data = ticker.history(period="1d", timeout=5)
            return not data.empty
        except Exception as e:
            logger.warning(f"Yahoo Finance health check failed: {e}")
            return False
    
    async def get_company_info(self, symbol: str) -> Optional[dict]:
        """
        Get company information from Yahoo Finance.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Dictionary with company information
        """
        try:
            ticker = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: yf.Ticker(symbol)
            )
            
            info = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: ticker.info
            )
            
            return info
            
        except Exception as e:
            logger.warning(f"Failed to get company info for {symbol}: {e}")
            return None