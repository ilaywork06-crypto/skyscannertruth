"""Logging: one UTC line format on stdout for every service, e.g.
`2026-08-11T10:00:00.123Z | INFO     | storage-service | message`."""

import logging
import sys
import time

LOG_FORMAT = "%(asctime)s.%(msecs)03dZ | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%dT%H:%M:%S"


def configure_logging(service_name: str, level: str = "INFO") -> logging.Logger:
    formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
    formatter.converter = time.gmtime
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())
    return logging.getLogger(service_name)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
