"""
Custom exceptions for the price ingestion service.
"""


class IngestionError(Exception):
    """Base exception for ingestion-related errors."""
    pass


class DataSourceError(IngestionError):
    """Exception raised when a data source fails."""
    pass


class DatabaseError(IngestionError):
    """Exception raised for database-related errors."""
    pass


class CacheError(IngestionError):
    """Exception raised for cache-related errors."""
    pass


class ConfigurationError(IngestionError):
    """Exception raised for configuration errors."""
    pass


class RateLimitError(DataSourceError):
    """Exception raised when API rate limits are exceeded."""
    pass


class ValidationError(IngestionError):
    """Exception raised for data validation errors."""
    pass