"""
Logging and error-handling helpers for the SVT Test Agent.

This module provides:
  - setup_logger: unified console + file logging setup.
  - graceful_shutdown: signal handlers for clean Kafka shutdown.
  - error_wrapper: decorator to log exceptions around functions.

Location: svt_test_agent/utilities/logging_utils.py
"""

import functools
import logging
import signal
import sys
import traceback


def setup_logger(name: str, level=logging.INFO) -> logging.Logger:
    """
    Create or retrieve a logger with a standard console + file setup.

    Console:
      - INFO and above to stdout.
    File:
      - DEBUG and above to 'debug.log' (append mode, UTF-8).

    Handlers are only attached once per logger name.
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        # Console handler (INFO and above)
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(logging.INFO)
        ch.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )

        # File handler (DEBUG and above)
        fh = logging.FileHandler("debug.log", mode="a", encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )

        logger.addHandler(ch)
        logger.addHandler(fh)
        # Let handlers filter levels; logger itself is DEBUG
        logger.setLevel(logging.DEBUG)

    return logger


def graceful_shutdown(consumer=None, producer=None, logger=None):
    """
    Register graceful shutdown for Kafka-like consumer/producer objects.

    On SIGINT or SIGTERM:
      - consumer.close() is called if provided.
      - producer.flush() is called if provided.
      - exit code 0.
    """
    def handle_sigterm(sig, frame):
        if logger:
            logger.info("Shutdown signal received, closing resources...")

        try:
            if consumer:
                consumer.close()
                if logger:
                    logger.info("Kafka consumer closed.")
            if producer:
                producer.flush()
                if logger:
                    logger.info("Kafka producer flushed & closed.")
        except Exception as e:
            if logger:
                logger.error(f"Error during shutdown: {e}")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_sigterm)
    signal.signal(signal.SIGTERM, handle_sigterm)


def error_wrapper(func):
    """
    Decorator that wraps a function in a try/except with logging.

    On exception:
      - logs a one-line ERROR with the exception message.
      - logs the full traceback at DEBUG level.
      - returns None.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        logger = setup_logger(func.__module__)
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Exception in {func.__name__}: {e}")
            logger.debug(traceback.format_exc())
            return None

    return wrapper