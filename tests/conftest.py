"""
Pytest configuration and shared fixtures
"""
import pytest
import os
from datetime import datetime, timezone
from unittest.mock import MagicMock

# Set test environment variables before importing config
os.environ["SMARTSUITE_API_KEY"] = "test_api_key_12345"
os.environ["SMARTSUITE_ACCOUNT_ID"] = "test_account_id"
os.environ["SOURCE_CUSTOMERS_TABLE_ID"] = "test_source_table"
os.environ["DESTINATION_INTELLIGENCE_HUB_TABLE_ID"] = "test_dest_table"
os.environ["SOLUTION_ID"] = "test_solution_id"
os.environ["LOG_LEVEL"] = "DEBUG"

from utils.smartsuite_api import SmartSuiteAPI


@pytest.fixture
def sample_source_customer():
    """Sample customer record from main CRM"""
    return {
        "id": "rec_12345",
        "title": "Acme Dental Office",
        "sf17aef823": "Retail; Company",  # Customer Type
        "sf910a12e2": "A (50)",  # Retail Category
        "s4b7a3f28a": "7",  # Completed Orders
        "s0542830c2": ["https://www.acmedental.com"],  # Website URLs
        "s889d079ed": "Great customer, always pays on time. Orders branded scrubs.",  # Company Notes
        "sdaea1a4ce": ["billing@acmedental.com"],  # Email for Followups
        "sffaeae042": {  # Contacts (sub-items)
            "count": 2,
            "items": [
                {
                    "id": "contact_1",
                    "sd4f0d01f0": {  # Full Name
                        "first_name": "John",
                        "last_name": "Smith",
                        "sys_root": "John Smith"
                    },
                    "s080dbe686": ["john.smith@acmedental.com"],  # Email
                    "s8e9b74ad0": [  # Phone
                        {
                            "phone_number": "555-123-4567",
                            "phone_country": "US",
                            "phone_extension": "",
                            "phone_type": 1
                        }
                    ]
                },
                {
                    "id": "contact_2",
                    "sd4f0d01f0": {
                        "first_name": "Jane",
                        "last_name": "Doe",
                        "sys_root": "Jane Doe"
                    },
                    "s080dbe686": ["jane.doe@acmedental.com"],
                    "s8e9b74ad0": []
                }
            ]
        }
    }


@pytest.fixture
def sample_source_customer_minimal():
    """Customer with minimal data (testing edge cases)"""
    return {
        "id": "rec_67890",
        "title": "Smith Family",
        "sf17aef823": "Retail; Individual",
        "s4b7a3f28a": "0",  # No orders
        "sffaeae042": {"count": 0, "items": []},  # No contacts
    }


@pytest.fixture
def sample_source_customer_no_contacts():
    """Customer with no contact information"""
    return {
        "id": "rec_99999",
        "title": "Corporate Office LLC",
        "sf17aef823": "Retail; Company",
        "s4b7a3f28a": "3",
        "sffaeae042": {"count": 0, "items": []}
    }


@pytest.fixture
def sample_transformed_customer():
    """Expected transformed customer for Intelligence Hub"""
    return {
        "record_type": "Existing Customer",
        "import_batch_id": "2026-01-23-120000",
        "company_name": "Acme Dental Office",
        "contact_name": "John Smith",
        "email": ["john.smith@acmedental.com", "billing@acmedental.com"],
        "phone_number": [{
            "phone_country": "US",
            "phone_number": "555-123-4567",
            "phone_extension": "",
            "phone_type": 1
        }],
        "industry_business_type": "Corporate Office",
        "number_of_jobs": "7",
        "priority_tier": "Tier 1 - High Value",
        "website_url": "https://www.acmedental.com",
        "lead_status": "Existing Customer",
        "lead_source": "Main CRM Import",
        "research_status": "Not Started"
    }


@pytest.fixture
def mock_api_response_list_records():
    """Mock API response for listing records"""
    return {
        "items": [
            {"id": "rec_1", "title": "Customer 1"},
            {"id": "rec_2", "title": "Customer 2"},
            {"id": "rec_3", "title": "Customer 3"}
        ],
        "total": 3,
        "offset": 0
    }


@pytest.fixture
def mock_api_response_create_records():
    """Mock API response for creating records"""
    return [
        {"id": "new_rec_1", "company_name": "New Customer 1"},
        {"id": "new_rec_2", "company_name": "New Customer 2"}
    ]


@pytest.fixture
def mock_smartsuite_api(mocker):
    """Mock SmartSuite API client"""
    mock = mocker.MagicMock(spec=SmartSuiteAPI)
    mock.get_all_records.return_value = []
    mock.create_records_batched.return_value = []
    return mock


@pytest.fixture
def batch_id():
    """Standard batch ID for testing"""
    return "2026-01-23-120000"


@pytest.fixture
def frozen_time(monkeypatch):
    """Freeze time for consistent testing"""
    fixed_datetime = datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc)

    class FakeDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_datetime

    monkeypatch.setattr("datetime.datetime", FakeDatetime)
    return fixed_datetime
