"""
Integration tests for the complete import workflow
Tests end-to-end import process with mocked API
"""
import pytest
import responses
from unittest.mock import patch, MagicMock
from config import Config
from utils.smartsuite_api import SmartSuiteAPI
from utils.field_mapping import batch_transform_records, create_batch_id


class TestEndToEndImportWorkflow:
    """Test complete import workflow"""

    @responses.activate
    def test_full_import_workflow_success(self, sample_source_customer):
        """Test complete import from fetch to create"""
        source_table_id = Config.SOURCE_CUSTOMERS_TABLE_ID
        dest_table_id = Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID

        # Mock fetching source records
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{source_table_id}/records/list/",
            json={
                "items": [sample_source_customer] * 3,
                "total": 3,
                "offset": 0
            },
            status=200
        )

        # Mock creating destination records
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{dest_table_id}/records/",
            json=[
                {"id": f"new_rec_{i}", "company_name": "Acme Dental Office"}
                for i in range(3)
            ],
            status=201
        )

        # Execute workflow
        api = SmartSuiteAPI()

        # Step 1: Fetch source records
        source_records = api.get_all_records(source_table_id)
        assert len(source_records) == 3

        # Step 2: Transform records
        batch_id = create_batch_id()
        transformed_records = batch_transform_records(source_records, batch_id)
        assert len(transformed_records) == 3

        # Step 3: Create records
        created_records = api.create_records_batched(dest_table_id, transformed_records)
        assert len(created_records) == 3

    @responses.activate
    def test_import_workflow_with_empty_source(self):
        """Test import when source table is empty"""
        source_table_id = Config.SOURCE_CUSTOMERS_TABLE_ID
        dest_table_id = Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID

        # Mock empty source
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{source_table_id}/records/list/",
            json={"items": [], "total": 0, "offset": 0},
            status=200
        )

        api = SmartSuiteAPI()
        source_records = api.get_all_records(source_table_id)

        assert source_records == []

        # Transform should also return empty
        batch_id = create_batch_id()
        transformed = batch_transform_records(source_records, batch_id)
        assert transformed == []

    @responses.activate
    def test_import_workflow_large_dataset(self, sample_source_customer):
        """Test import with pagination (100+ records)"""
        source_table_id = Config.SOURCE_CUSTOMERS_TABLE_ID

        # Mock multiple pages
        total_records = 150
        batch_size = 100

        # First page
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{source_table_id}/records/list/",
            json={
                "items": [sample_source_customer] * batch_size,
                "total": total_records,
                "offset": 0
            },
            status=200
        )

        # Second page
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{source_table_id}/records/list/",
            json={
                "items": [sample_source_customer] * 50,
                "total": total_records,
                "offset": batch_size
            },
            status=200
        )

        api = SmartSuiteAPI()
        source_records = api.get_all_records(source_table_id, batch_size=batch_size)

        assert len(source_records) == 150
        assert len(responses.calls) == 2

    @responses.activate
    def test_import_workflow_batched_creation(self, sample_source_customer):
        """Test creating records in batches of 25"""
        dest_table_id = Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID

        # Create 60 records (should be 3 batches: 25 + 25 + 10)
        records = [sample_source_customer] * 60

        # Mock 3 batch creation calls
        for i in range(3):
            batch_size = 25 if i < 2 else 10
            responses.add(
                responses.POST,
                f"{Config.SMARTSUITE_BASE_URL}/applications/{dest_table_id}/records/",
                json=[{"id": f"rec_{j}"} for j in range(batch_size)],
                status=201
            )

        batch_id = create_batch_id()
        transformed = batch_transform_records(records, batch_id)

        api = SmartSuiteAPI()
        created = api.create_records_batched(dest_table_id, transformed)

        assert len(created) == 60
        assert len(responses.calls) == 3


class TestImportScriptCLI:
    """Test import script command-line interface"""

    def test_import_script_dry_run(self, mocker, sample_source_customer):
        """Test dry run mode doesn't create records"""
        # Mock API to return sample data
        mock_api = mocker.MagicMock()
        mock_api.get_all_records.return_value = [sample_source_customer]

        mocker.patch('scripts.import_customers.SmartSuiteAPI', return_value=mock_api)

        # Import and run with dry_run
        from scripts.import_customers import main
        with patch('sys.argv', ['import_customers.py', '--dry-run']):
            result = main()

        # Should succeed
        assert result == 0

        # Should fetch records
        assert mock_api.get_all_records.called

        # Should NOT create records in dry run
        assert not mock_api.create_records_batched.called

    def test_import_script_with_limit(self, mocker, sample_source_customer):
        """Test --limit flag limits records"""
        mock_api = mocker.MagicMock()
        mock_api.get_all_records.return_value = [sample_source_customer] * 100
        mock_api.create_records_batched.return_value = []

        mocker.patch('scripts.import_customers.SmartSuiteAPI', return_value=mock_api)

        from scripts.import_customers import main
        with patch('sys.argv', ['import_customers.py', '--limit', '10']):
            result = main()

        # Should create only 10 records
        if mock_api.create_records_batched.called:
            call_args = mock_api.create_records_batched.call_args
            # call_args is (args, kwargs) - get the positional args
            args, kwargs = call_args
            records_arg = args[1] if len(args) > 1 else kwargs.get('records', [])
            assert len(records_arg) == 10


class TestDataQualityWorkflow:
    """Test data quality aspects of import"""

    def test_priority_tier_distribution(self, sample_source_customer):
        """Test that priority tiers are calculated correctly across batch"""
        # Create customers with varying order counts
        customers = []
        for i in range(10):
            customer = sample_source_customer.copy()
            customer["s4b7a3f28a"] = str(i)  # 0-9 orders
            customer["title"] = f"Customer {i}"
            customers.append(customer)

        batch_id = create_batch_id()
        transformed = batch_transform_records(customers, batch_id)

        # Count tiers
        tier_counts = {}
        for record in transformed:
            tier = record["priority_tier"]
            tier_counts[tier] = tier_counts.get(tier, 0) + 1

        # Verify distribution
        assert tier_counts.get("Unrated", 0) == 1  # 0 orders
        assert tier_counts.get("Tier 3 - Lower Value", 0) == 2  # 1-2 orders
        assert tier_counts.get("Tier 2 - Medium Value", 0) == 2  # 3-4 orders
        assert tier_counts.get("Tier 1 - High Value", 0) == 5  # 5-9 orders

    def test_contact_extraction_quality(self, sample_source_customer):
        """Test contact extraction across different data quality levels"""
        import copy

        # High quality: full contact info
        high_quality = copy.deepcopy(sample_source_customer)

        # Medium quality: no phone
        medium_quality = copy.deepcopy(sample_source_customer)
        medium_quality["sffaeae042"]["items"][0]["s8e9b74ad0"] = []
        medium_quality["sdaea1a4ce"] = []  # No followup emails

        # Low quality: no contacts
        low_quality = copy.deepcopy(sample_source_customer)
        low_quality["sffaeae042"] = {"count": 0, "items": []}
        low_quality["sdaea1a4ce"] = []  # No followup emails

        customers = [high_quality, medium_quality, low_quality]
        batch_id = create_batch_id()
        transformed = batch_transform_records(customers, batch_id)

        # High quality should have all contact info
        assert transformed[0]["contact_name"] != ""
        assert len(transformed[0]["email"]) > 0
        assert len(transformed[0]["phone_number"]) > 0

        # Medium quality should have name and email, no phone
        assert transformed[1]["contact_name"] != ""
        assert len(transformed[1]["email"]) > 0
        assert len(transformed[1]["phone_number"]) == 0

        # Low quality should have empty contact fields
        assert transformed[2]["contact_name"] == ""
        assert len(transformed[2]["email"]) == 0
        assert len(transformed[2]["phone_number"]) == 0

    def test_email_deduplication(self):
        """Test that duplicate emails are removed"""
        from utils.field_mapping import transform_customer_record

        customer = {
            "title": "Test Company",
            "s4b7a3f28a": "5",
            "sdaea1a4ce": ["contact@test.com", "contact@test.com"],  # Duplicate followup
            "sffaeae042": {
                "count": 1,
                "items": [{
                    "sd4f0d01f0": {"sys_root": "John Doe"},
                    "s080dbe686": ["contact@test.com"],  # Same as followup
                    "s8e9b74ad0": []
                }]
            }
        }

        batch_id = create_batch_id()
        transformed = transform_customer_record(customer, batch_id)

        # Should have only one email despite duplicates
        assert len(transformed["email"]) == 1
        assert transformed["email"][0] == "contact@test.com"
