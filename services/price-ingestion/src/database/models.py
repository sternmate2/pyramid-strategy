"""
Database models for stock price data.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class PriceData:
    """
    Represents stock price data for a single time period.
    """
    symbol: str
    close_price: float
    timestamp: datetime
    source: str
    open_price: Optional[float] = None
    high_price: Optional[float] = None
    low_price: Optional[float] = None
    volume: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate and normalize data after initialization."""
        self.symbol = self.symbol.upper()
        
        # Validate required fields
        if not self.symbol:
            raise ValueError("Symbol is required")
        if self.close_price is None or self.close_price <= 0:
            raise ValueError("Close price must be positive")
        if not self.timestamp:
            raise ValueError("Timestamp is required")
        if not self.source:
            raise ValueError("Source is required")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'symbol': self.symbol,
            'open': self.open_price,
            'high': self.high_price,
            'low': self.low_price,
            'close': self.close_price,
            'volume': self.volume,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'source': self.source,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PriceData':
        """Create PriceData from dictionary."""
        timestamp = data.get('timestamp')
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)
        
        return cls(
            symbol=data['symbol'],
            open_price=data.get('open'),
            high_price=data.get('high'),
            low_price=data.get('low'),
            close_price=data['close'],
            volume=data.get('volume'),
            timestamp=timestamp,
            source=data['source'],
            metadata=data.get('metadata', {})
        )


@dataclass
class StockInstrument:
    """
    Represents a stock instrument/symbol with metadata.
    """
    symbol: str
    name: Optional[str] = None
    exchange: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate and normalize data after initialization."""
        self.symbol = self.symbol.upper()
        
        if not self.symbol:
            raise ValueError("Symbol is required")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'symbol': self.symbol,
            'name': self.name,
            'exchange': self.exchange,
            'sector': self.sector,
            'industry': self.industry,
            'market_cap': self.market_cap,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'metadata': self.metadata
        }