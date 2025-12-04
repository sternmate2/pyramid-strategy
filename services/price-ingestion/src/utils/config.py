"""
Configuration management for the price ingestion service.
"""

import os
from typing import List
from dataclasses import dataclass, field


@dataclass
class Config:
    """Configuration class for the ingestion service."""
    
    # Environment
    ENVIRONMENT: str = os.getenv('NODE_ENV', 'development')
    
    # API Keys
    FINNHUB_API_KEY: str = os.getenv('FINNHUB_API_KEY', '')
    ALPHAVANTAGE_API_KEY: str = os.getenv('ALPHAVANTAGE_API_KEY', '')
    
    # Database
    DATABASE_URL: str = os.getenv('DATABASE_URL', 
                                  'postgresql://stockuser:securepassword123@localhost:5432/stock_anomaly')
    
    # Redis
    REDIS_HOST: str = os.getenv('REDIS_HOST', 'localhost')
    REDIS_PORT: int = int(os.getenv('REDIS_PORT', '6379'))
    REDIS_PASSWORD: str = os.getenv('REDIS_PASSWORD', '')
    REDIS_DB: int = int(os.getenv('REDIS_DB', '0'))
    
    # Application
    INGESTION_HOST: str = os.getenv('INGESTION_HOST', '0.0.0.0')
    INGESTION_PORT: int = int(os.getenv('INGESTION_PORT', '8080'))
    
    # Logging
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'info').upper()
    LOG_FORMAT: str = os.getenv('LOG_FORMAT', 'json')
    
    # Ingestion Configuration
    TRACKED_SYMBOLS: List[str] = field(default_factory=lambda: os.getenv('TRACKED_SYMBOLS', 'SPY,QQQ,IWM,BTC/USD').split(','))
    REALTIME_INTERVAL: int = int(os.getenv('REALTIME_INTERVAL', '1'))  # minutes
    DAILY_INTERVAL: int = int(os.getenv('DAILY_INTERVAL', '60'))  # minutes
    
    # Market Hours (UTC/GMT for NASDAQ)
    MARKET_OPEN_HOUR: int = int(os.getenv('MARKET_OPEN_HOUR', '14'))  # 2:30 PM UTC
    MARKET_OPEN_MINUTE: int = int(os.getenv('MARKET_OPEN_MINUTE', '30'))
    MARKET_CLOSE_HOUR: int = int(os.getenv('MARKET_CLOSE_HOUR', '21'))  # 9:00 PM UTC
    MARKET_CLOSE_MINUTE: int = int(os.getenv('MARKET_CLOSE_MINUTE', '0'))
    
    # Request Timeouts (seconds)
    FINNHUB_TIMEOUT: int = int(os.getenv('FINNHUB_TIMEOUT', '10'))
    YAHOO_TIMEOUT: int = int(os.getenv('YAHOO_TIMEOUT', '15'))
    ALPHAVANTAGE_TIMEOUT: int = int(os.getenv('ALPHAVANTAGE_TIMEOUT', '20'))
    
    # Retry Configuration
    MAX_RETRIES: int = int(os.getenv('MAX_RETRIES', '3'))
    RETRY_DELAY: int = int(os.getenv('RETRY_DELAY', '1000'))  # milliseconds
    BACKOFF_FACTOR: int = int(os.getenv('BACKOFF_FACTOR', '2'))
    
    # Development
    DEBUG: bool = os.getenv('DEBUG', 'false').lower() == 'true'
    MOCK_EXTERNAL_APIS: bool = os.getenv('MOCK_EXTERNAL_APIS', 'false').lower() == 'true'
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        # Clean up tracked symbols
        self.TRACKED_SYMBOLS = [s.strip().upper() for s in self.TRACKED_SYMBOLS if s.strip()]
        
        # Validate required API keys for production
        if self.ENVIRONMENT == 'production':
            if not self.FINNHUB_API_KEY:
                raise ValueError("FINNHUB_API_KEY is required for production")
    
    @property
    def redis_url(self) -> str:
        """Get Redis connection URL."""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        else:
            return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"


# Global configuration instance
config = Config()