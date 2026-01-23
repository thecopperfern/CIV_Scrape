"""
Configuration management for CIV Enterprises Customer Prospecting System
Loads environment variables and provides centralized config access
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv()

class Config:
    """Application configuration"""

    # SmartSuite API
    SMARTSUITE_API_KEY = os.getenv("SMARTSUITE_API_KEY")
    SMARTSUITE_ACCOUNT_ID = os.getenv("SMARTSUITE_ACCOUNT_ID")
    SMARTSUITE_BASE_URL = "https://app.smartsuite.com/api/v1"

    # Table IDs
    SOURCE_CUSTOMERS_TABLE_ID = os.getenv(
        "SOURCE_CUSTOMERS_TABLE_ID",
        "65fa17c1c4bf7d283e83807a"
    )
    DESTINATION_INTELLIGENCE_HUB_TABLE_ID = os.getenv(
        "DESTINATION_INTELLIGENCE_HUB_TABLE_ID",
        "6972e0912eaf730900141a54"
    )
    SOLUTION_ID = os.getenv(
        "SOLUTION_ID",
        "6972e0912eaf730900141a53"
    )

    # Import Settings
    IMPORT_BATCH_SIZE = int(os.getenv("IMPORT_BATCH_SIZE", "25"))
    DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    # Paths
    PROJECT_ROOT = Path(__file__).parent
    LOGS_DIR = PROJECT_ROOT / "logs"

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        required = [
            "SMARTSUITE_API_KEY",
            "SMARTSUITE_ACCOUNT_ID"
        ]
        missing = [key for key in required if not getattr(cls, key)]
        if missing:
            raise ValueError(f"Missing required config: {', '.join(missing)}")

        # Create logs directory if it doesn't exist
        cls.LOGS_DIR.mkdir(exist_ok=True)

# Validate on import
Config.validate()
