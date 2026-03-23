import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Application settings and environment configuration.
    Security: Sensitive keys like SECRET_KEY must be provided via environment variables.
    """
    APP_NAME: str = "Omniflow API"
    
    # Security: No default allowed for SECRET_KEY in production-like settings.
    # Fallback to a placeholder only if explicitly handled, but here we require it.
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = "HS256"
    
    # Session Management: Reduced lifespan for better security (30 minutes).
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/supplier_core")
    
    def __init__(self, **values):
        super().__init__(**values)
        if not self.SECRET_KEY:
            # Critical: Prevents application startup if security keys are missing.
            raise RuntimeError("SECRET_KEY environment variable is not set!")

    class Config:
        env_file = ".env"

settings = Settings()
