# src/utils/logger.py
"""
Logging configuration for the Football Video Bot.
"""

import logging
import sys
from datetime import datetime


# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for different log levels."""
    
    FORMATS = {
        logging.DEBUG: Colors.CYAN + "%(levelname)s" + Colors.ENDC + " - %(message)s",
        logging.INFO: Colors.GREEN + "%(levelname)s" + Colors.ENDC + " - %(message)s",
        logging.WARNING: Colors.WARNING + "%(levelname)s" + Colors.ENDC + " - %(message)s",
        logging.ERROR: Colors.FAIL + "%(levelname)s" + Colors.ENDC + " - %(message)s",
        logging.CRITICAL: Colors.BOLD + Colors.FAIL + "%(levelname)s" + Colors.ENDC + " - %(message)s",
    }
    
    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno, "%(levelname)s - %(message)s")
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)


class PlainFormatter(logging.Formatter):
    """Plain formatter for non-TTY output (GitHub Actions)."""
    
    def format(self, record):
        return f"{record.levelname} - {record.message}"


def setup_logger(level: str = None):
    """Configure the root logger."""
    import os
    
    # Determine log level
    log_level = level or os.environ.get('LOG_LEVEL', 'INFO')
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    
    # Use colored formatter for TTY, plain for CI
    if sys.stdout.isatty():
        console_handler.setFormatter(ColoredFormatter())
    else:
        console_handler.setFormatter(PlainFormatter())
    
    root_logger.addHandler(console_handler)
    
    # Reduce noise from third-party libraries
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('aiohttp').setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)
