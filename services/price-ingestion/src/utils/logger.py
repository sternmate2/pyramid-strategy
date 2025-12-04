"""
Logging configuration for the price ingestion service.
"""

import sys
import logging
from loguru import logger as loguru_logger
from .config import config


class InterceptHandler(logging.Handler):
    """Intercept standard logging and redirect to loguru."""
    
    def emit(self, record):
        # Get corresponding Loguru level if it exists
        try:
            level = loguru_logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        loguru_logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging():
    """Configure logging for the application."""
    # Remove default loguru handler
    loguru_logger.remove()
    
    # Configure loguru format based on environment
    if config.LOG_FORMAT == 'json':
        # JSON format for production
        format_string = (
            "{{"
            '"timestamp": "{time:YYYY-MM-DD HH:mm:ss.SSS}", '
            '"level": "{level}", '
            '"service": "price-ingestion", '
            '"module": "{module}", '
            '"function": "{function}", '
            '"line": {line}, '
            '"message": "{message}"'
            "}}\n"
        )
    else:
        # Human readable format for development
        format_string = (
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{module}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        )
    
    # Add loguru handler for stdout
    loguru_logger.add(
        sys.stdout,
        format=format_string,
        level=config.LOG_LEVEL,
        colorize=config.LOG_FORMAT != 'json',
        serialize=config.LOG_FORMAT == 'json'
    )
    
    # Add file handler for persistent logs
    log_file = "logs/price-ingestion.log"
    loguru_logger.add(
        log_file,
        rotation="100 MB",
        retention="30 days",
        compression="gz",
        format=format_string,
        level=config.LOG_LEVEL,
        serialize=config.LOG_FORMAT == 'json'
    )
    
    # Add error log file for errors only
    error_log_file = "logs/price-ingestion-error.log"
    loguru_logger.add(
        error_log_file,
        rotation="50 MB",
        retention="60 days",
        compression="gz",
        format=format_string,
        level="ERROR",
        serialize=config.LOG_FORMAT == 'json'
    )
    
    # Intercept standard library logging
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    
    # Reduce noise from some libraries but keep important messages
    logging.getLogger("asyncpg").setLevel(logging.WARNING)
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
    logging.getLogger("yfinance").setLevel(logging.CRITICAL)  # Suppress Yahoo Finance errors completely
    logging.getLogger("urllib3").setLevel(logging.CRITICAL)   # Suppress HTTP request errors
    logging.getLogger("requests").setLevel(logging.CRITICAL)  # Suppress requests library errors
    
    # Keep important database and HTTP client logs
    logging.getLogger("asyncpg.connection").setLevel(logging.INFO)
    logging.getLogger("aiohttp.client").setLevel(logging.INFO)


# Initialize logging first
setup_logging()

# Now we can use the logger to log setup completion
loguru_logger.info("🔧 Logging configuration setup completed")
loguru_logger.info(f"📝 Log format: {config.LOG_FORMAT}")
loguru_logger.info(f"📊 Log level: {config.LOG_LEVEL}")
loguru_logger.info(f"🌍 Environment: {config.ENVIRONMENT}")
loguru_logger.info("✅ Logging system ready")

# Export the configured logger
logger = loguru_logger