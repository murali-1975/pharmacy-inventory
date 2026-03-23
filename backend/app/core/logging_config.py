"""
Logging Configuration and Middleware.
Centralizes system logging with timed file rotation and request/response observability.
"""
import logging
import time
import os
from logging.handlers import TimedRotatingFileHandler
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Path Resolution: Ensure 'logs' directory exists in the application root
log_dir = os.path.join(os.getcwd(), "logs")
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
log_file = os.path.join(log_dir, "app.log")

# Global Logging Setup: Configures Stream (Console) and TimedRotatingFile (Disk) handlers.
# Retention: Retains logs for 7 days, rotating daily at midnight.
logging.basicConfig(
    level=logging.INFO,
    format=log_format,
    handlers=[
        logging.StreamHandler(),
        TimedRotatingFileHandler(log_file, when="midnight", interval=1, backupCount=7)
    ]
)

logger = logging.getLogger("Omniflow")

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    HTTP Middleware for request/response observability.
    Logs method, path, status code, and processing time for every request.
    Captures and logs tracebacks for unhandled exceptions before re-raising.
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            logger.info(
                f"Method: {request.method} Path: {request.url.path} "
                f"Status: {response.status_code} ProcessTime: {process_time:.4f}s"
            )
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"Method: {request.method} Path: {request.url.path} "
                f"Error: {str(e)} ProcessTime: {process_time:.4f}s",
                exc_info=True
            )
            raise e
