"""
Data sources package for stock price ingestion.
"""

from .base import BaseDataSource
from .finnhub import FinnhubDataSource  
from .yahoo import YahooDataSource
from .alpha_vantage import AlphaVantageDataSource
from .coingecko import CoinGeckoDataSource

from typing import Dict
from ..utils.config import config
from ..utils.logger import logger


class DataSourceFactory:
    """Factory for creating and managing data sources."""
    
    @classmethod
    def create_all(cls) -> Dict[str, BaseDataSource]:
        """Create all available data sources based on configuration."""
        sources = {}
        
        # Finnhub (Primary)
        if config.FINNHUB_API_KEY:
            try:
                sources['finnhub'] = FinnhubDataSource(config.FINNHUB_API_KEY)
                logger.info("✓ Finnhub data source initialized")
            except Exception as e:
                logger.error(f"✗ Failed to initialize Finnhub: {e}")
        else:
            logger.warning("Finnhub API key not provided")
        
        # Yahoo Finance (Secondary)
        try:
            sources['yahoo'] = YahooDataSource()
            logger.info("✓ Yahoo Finance data source initialized")
        except Exception as e:
            logger.error(f"✗ Failed to initialize Yahoo Finance: {e}")
        
        # Alpha Vantage (Historical)
        if config.ALPHAVANTAGE_API_KEY:
            try:
                sources['alpha_vantage'] = AlphaVantageDataSource(config.ALPHAVANTAGE_API_KEY)
                logger.info("✓ Alpha Vantage data source initialized")
            except Exception as e:
                logger.error(f"✗ Failed to initialize Alpha Vantage: {e}")
        else:
            logger.warning("Alpha Vantage API key not provided")
        
        # CoinGecko (Cryptocurrency)
        try:
            sources['coingecko'] = CoinGeckoDataSource()
            logger.info("✓ CoinGecko data source initialized")
        except Exception as e:
            logger.error(f"✗ Failed to initialize CoinGecko: {e}")
        
        if not sources:
            raise RuntimeError("No data sources could be initialized")
        
        logger.info(f"Initialized {len(sources)} data sources: {list(sources.keys())}")
        return sources

__all__ = [
    'BaseDataSource',
    'FinnhubDataSource', 
    'YahooDataSource',
    'AlphaVantageDataSource',
    'CoinGeckoDataSource',
    'DataSourceFactory'
]