"""
Configuration management for Prospect Forge
Loads environment variables and provides centralized config access.

Reads PF_* env vars first (injected per-org by the Node runner from the
encrypted org_integrations row), falls back to legacy SMARTSUITE_* env vars
so existing CIV scripts keep working as the org #1 default.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


def _env(*names, default=None):
    for n in names:
        v = os.getenv(n)
        if v:
            return v
    return default


class Config:
    """Application configuration"""

    SMARTSUITE_API_KEY = _env("PF_SMARTSUITE_API_KEY", "SMARTSUITE_API_KEY")
    SMARTSUITE_ACCOUNT_ID = _env("PF_SMARTSUITE_ACCOUNT_ID", "SMARTSUITE_ACCOUNT_ID")
    SMARTSUITE_BASE_URL = "https://app.smartsuite.com/api/v1"

    SOURCE_CUSTOMERS_TABLE_ID = _env(
        "PF_SOURCE_TABLE_ID",
        "SOURCE_CUSTOMERS_TABLE_ID",
        default="65fa17c1c4bf7d283e83807a",
    )
    DESTINATION_INTELLIGENCE_HUB_TABLE_ID = _env(
        "PF_DEST_TABLE_ID",
        "DESTINATION_INTELLIGENCE_HUB_TABLE_ID",
        default="6972e0912eaf730900141a54",
    )
    SOLUTION_ID = os.getenv("SOLUTION_ID", "6972e0912eaf730900141a53")

    ORG_ID = os.getenv("PF_ORG_ID")
    JOB_ID = os.getenv("PF_JOB_ID")

    IMPORT_BATCH_SIZE = int(os.getenv("IMPORT_BATCH_SIZE", "25"))
    DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    PROJECT_ROOT = Path(__file__).parent
    LOGS_DIR = PROJECT_ROOT / "logs"

    @classmethod
    def validate(cls):
        """Validate required configuration (call lazily, not on import)."""
        required = ["SMARTSUITE_API_KEY", "SMARTSUITE_ACCOUNT_ID"]
        missing = [key for key in required if not getattr(cls, key)]
        if missing:
            raise ValueError(f"Missing required config: {', '.join(missing)}")
        cls.LOGS_DIR.mkdir(exist_ok=True)
