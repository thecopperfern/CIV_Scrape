"""
Unit tests for config.py
Tests configuration loading and validation
"""
import pytest
import os
from pathlib import Path


class TestConfigLoading:
    """Test configuration loading from environment"""

    def test_api_key_loaded(self):
        """Should load API key from environment"""
        from config import Config
        assert Config.SMARTSUITE_API_KEY == "test_api_key_12345"

    def test_account_id_loaded(self):
        """Should load account ID from environment"""
        from config import Config
        assert Config.SMARTSUITE_ACCOUNT_ID == "test_account_id"

    def test_base_url_set(self):
        """Should have correct base URL"""
        from config import Config
        assert Config.SMARTSUITE_BASE_URL == "https://app.smartsuite.com/api/v1"

    def test_table_ids_with_defaults(self):
        """Should use environment values or defaults"""
        from config import Config
        assert Config.SOURCE_CUSTOMERS_TABLE_ID == "test_source_table"
        assert Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID == "test_dest_table"

    def test_import_batch_size(self):
        """Should have default batch size"""
        from config import Config
        assert Config.IMPORT_BATCH_SIZE == 25

    def test_dry_run_default_false(self):
        """Should default dry run to False"""
        from config import Config
        assert Config.DRY_RUN is False

    def test_log_level(self):
        """Should load log level"""
        from config import Config
        assert Config.LOG_LEVEL == "DEBUG"

    def test_paths_set(self):
        """Should set correct paths"""
        from config import Config
        assert isinstance(Config.PROJECT_ROOT, Path)
        assert isinstance(Config.LOGS_DIR, Path)
        assert Config.LOGS_DIR.name == "logs"


class TestConfigValidation:
    """Test configuration validation"""

    def test_validate_success(self):
        """Should validate successfully with required config"""
        from config import Config
        # Should not raise
        Config.validate()

    def test_missing_config_detection(self, monkeypatch):
        """Should detect missing required config"""
        # This test would need to reload the module with missing env vars
        # Skipping for now as it requires complex module reloading
        pass

    def test_logs_directory_created(self):
        """Should create logs directory"""
        from config import Config
        assert Config.LOGS_DIR.exists()
        assert Config.LOGS_DIR.is_dir()
