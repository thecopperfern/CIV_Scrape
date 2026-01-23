"""
Logging configuration for the application
Creates both file and console handlers with appropriate formatting
"""
import logging
from pathlib import Path
from datetime import datetime
from config import Config

def setup_logger(name: str, log_file: str = None) -> logging.Logger:
    """
    Set up a logger with file and console handlers

    Args:
        name: Logger name (usually __name__)
        log_file: Optional specific log file name (default: uses name + timestamp)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, Config.LOG_LEVEL))

    # Avoid duplicate handlers
    if logger.handlers:
        return logger

    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    simple_formatter = logging.Formatter(
        '%(levelname)s - %(message)s'
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(simple_formatter)
    logger.addHandler(console_handler)

    # File handler
    if log_file is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = f"{name.replace('.', '_')}_{timestamp}.log"

    log_path = Config.LOGS_DIR / log_file
    file_handler = logging.FileHandler(log_path)
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(detailed_formatter)
    logger.addHandler(file_handler)

    return logger
