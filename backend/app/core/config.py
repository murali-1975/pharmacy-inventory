import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.

    Required env vars:
        SECRET_KEY     : Random secret used to sign JWT tokens.
        DATABASE_URL   : Connection string for the PostgreSQL database.

    Optional env vars (have safe defaults):
        APP_NAME                   : Display name shown in API docs.
        ALGORITHM                  : JWT signing algorithm (default: HS256).
        ACCESS_TOKEN_EXPIRE_MINUTES: Token lifetime in minutes (default: 30).
    """

    # Application identity — shown in Swagger UI title
    APP_NAME: str = "Pharmacy Inventory API"

    # JWT signing key — MUST be set via environment variable in all deployments
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")

    # JWT algorithm — HS256 is standard and sufficient for this use case
    ALGORITHM: str = "HS256"

    # Token expiry — 30 minutes balances security and usability
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Feature Toggles (comma-separated list of active flags like "STAGING_ANALYTICS,NEW_UI")
    FEATURE_FLAGS: str = os.getenv("FEATURE_FLAGS", "")

    # Primary database connection string
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/pharmacy_inventory")

    def __init__(self, **values):
        super().__init__(**values)
        if not self.SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY environment variable is not set! "
                "Add it to your .env file or set it in your shell before starting the server."
            )

    def is_feature_enabled(self, feature_name: str) -> bool:
        """Checks if a specific feature flag is active."""
        flags = [f.strip() for f in self.FEATURE_FLAGS.split(",") if f.strip()]
        return feature_name in flags

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env")
        extra = "ignore"

settings = Settings()
