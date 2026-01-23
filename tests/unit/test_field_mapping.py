"""
Unit tests for utils/field_mapping.py
Tests all transformation functions and edge cases
"""
import pytest
from datetime import datetime, timezone
from utils.field_mapping import (
    create_batch_id,
    create_date_field,
    create_smartdoc,
    calculate_priority_tier,
    extract_primary_contact,
    map_industry,
    transform_customer_record,
    batch_transform_records
)


class TestCreateBatchId:
    """Test batch ID generation"""

    def test_batch_id_format(self):
        """Batch ID should be in YYYY-MM-DD-HHMMSS format"""
        batch_id = create_batch_id()
        assert len(batch_id) == 17  # YYYY-MM-DD-HHMMSS
        assert batch_id[4] == "-"
        assert batch_id[7] == "-"
        assert batch_id[10] == "-"

    def test_batch_id_uniqueness(self):
        """Sequential batch IDs should be different (if called at different times)"""
        batch_id1 = create_batch_id()
        import time
        time.sleep(1.1)  # Wait > 1 second
        batch_id2 = create_batch_id()
        assert batch_id1 != batch_id2


class TestCreateDateField:
    """Test date field creation"""

    def test_date_field_structure(self):
        """Date field should have correct structure"""
        date_field = create_date_field()
        assert "date" in date_field
        assert "include_time" in date_field
        assert date_field["include_time"] is False

    def test_date_field_with_time(self):
        """Date field with time should set include_time=True"""
        date_field = create_date_field(include_time=True)
        assert date_field["include_time"] is True

    def test_date_field_iso_format(self):
        """Date should be in ISO format"""
        date_field = create_date_field()
        # Should be parseable as datetime
        parsed = datetime.fromisoformat(date_field["date"].replace("Z", "+00:00"))
        assert isinstance(parsed, datetime)


class TestCreateSmartdoc:
    """Test SmartDoc creation"""

    def test_smartdoc_with_text(self):
        """SmartDoc should have correct structure with text"""
        text = "This is a test note"
        doc = create_smartdoc(text)

        assert "data" in doc
        assert "html" in doc
        assert "preview" in doc
        assert doc["data"]["type"] == "doc"
        assert len(doc["data"]["content"]) > 0
        assert doc["html"] == f"<p>{text}</p>"
        assert doc["preview"] == text

    def test_smartdoc_empty_text(self):
        """SmartDoc with empty text should have empty structure"""
        doc = create_smartdoc("")
        assert doc["data"]["content"] == []
        assert doc["html"] == ""
        assert doc["preview"] == ""

    def test_smartdoc_none(self):
        """SmartDoc with None should handle gracefully"""
        doc = create_smartdoc(None)
        assert doc["data"]["content"] == []

    def test_smartdoc_long_text_preview(self):
        """Preview should be truncated to 200 chars"""
        long_text = "A" * 300
        doc = create_smartdoc(long_text)
        assert len(doc["preview"]) == 200
        assert doc["preview"] == "A" * 200


class TestCalculatePriorityTier:
    """Test priority tier calculation"""

    def test_tier_1_high_value(self):
        """5+ jobs should be Tier 1"""
        assert calculate_priority_tier(5) == "Tier 1 - High Value"
        assert calculate_priority_tier(10) == "Tier 1 - High Value"
        assert calculate_priority_tier(100) == "Tier 1 - High Value"

    def test_tier_2_medium_value(self):
        """3-4 jobs should be Tier 2"""
        assert calculate_priority_tier(3) == "Tier 2 - Medium Value"
        assert calculate_priority_tier(4) == "Tier 2 - Medium Value"

    def test_tier_3_lower_value(self):
        """1-2 jobs should be Tier 3"""
        assert calculate_priority_tier(1) == "Tier 3 - Lower Value"
        assert calculate_priority_tier(2) == "Tier 3 - Lower Value"

    def test_unrated(self):
        """0 jobs should be Unrated"""
        assert calculate_priority_tier(0) == "Unrated"

    def test_negative_jobs(self):
        """Negative jobs should be Unrated"""
        assert calculate_priority_tier(-1) == "Unrated"


class TestExtractPrimaryContact:
    """Test contact extraction from sub-items"""

    def test_extract_full_contact(self, sample_source_customer):
        """Should extract all contact info from first contact"""
        contacts = sample_source_customer["sffaeae042"]
        name, email, phone = extract_primary_contact(contacts)

        assert name == "John Smith"
        assert email == "john.smith@acmedental.com"
        assert phone is not None
        assert len(phone) == 1
        assert phone[0]["phone_number"] == "555-123-4567"
        assert phone[0]["phone_country"] == "US"

    def test_extract_no_contacts(self):
        """Should return None values when no contacts"""
        contacts = {"count": 0, "items": []}
        name, email, phone = extract_primary_contact(contacts)

        assert name is None
        assert email is None
        assert phone is None

    def test_extract_contact_missing_email(self):
        """Should handle missing email gracefully"""
        contacts = {
            "count": 1,
            "items": [
                {
                    "sd4f0d01f0": {"sys_root": "John Doe"},
                    "s080dbe686": [],  # No email
                    "s8e9b74ad0": []
                }
            ]
        }
        name, email, phone = extract_primary_contact(contacts)

        assert name == "John Doe"
        assert email is None
        assert phone is None

    def test_extract_contact_missing_phone(self):
        """Should handle missing phone gracefully"""
        contacts = {
            "count": 1,
            "items": [
                {
                    "sd4f0d01f0": {"sys_root": "Jane Smith"},
                    "s080dbe686": ["jane@example.com"],
                    "s8e9b74ad0": []  # No phone
                }
            ]
        }
        name, email, phone = extract_primary_contact(contacts)

        assert name == "Jane Smith"
        assert email == "jane@example.com"
        assert phone is None

    def test_extract_contact_none_input(self):
        """Should handle None input"""
        name, email, phone = extract_primary_contact(None)

        assert name is None
        assert email is None
        assert phone is None


class TestMapIndustry:
    """Test industry mapping"""

    def test_map_wholesale(self):
        """Wholesale should map to Other"""
        assert map_industry("Retail; Wholesale") == "Other"
        assert map_industry("Wholesale") == "Other"

    def test_map_company(self):
        """Company should map to Corporate Office"""
        assert map_industry("Retail; Company") == "Corporate Office"
        assert map_industry("Company") == "Corporate Office"

    def test_map_individual(self):
        """Individual should map to Other"""
        assert map_industry("Retail; Individual") == "Other"

    def test_map_empty(self):
        """Empty customer type should map to Other"""
        assert map_industry("") == "Other"
        assert map_industry(None) == "Other"

    def test_map_case_insensitive(self):
        """Should be case insensitive"""
        assert map_industry("WHOLESALE") == "Other"
        assert map_industry("company") == "Corporate Office"


class TestTransformCustomerRecord:
    """Test full customer record transformation"""

    def test_transform_complete_record(self, sample_source_customer, batch_id):
        """Should transform complete record correctly"""
        transformed = transform_customer_record(sample_source_customer, batch_id)

        assert transformed["record_type"] == "Existing Customer"
        assert transformed["import_batch_id"] == batch_id
        assert transformed["company_name"] == "Acme Dental Office"
        assert transformed["contact_name"] == "John Smith"
        assert "john.smith@acmedental.com" in transformed["email"]
        assert transformed["number_of_jobs"] == "7"
        assert transformed["priority_tier"] == "Tier 1 - High Value"
        assert transformed["website_url"] == "https://www.acmedental.com"
        assert transformed["lead_status"] == "Existing Customer"
        assert transformed["lead_source"] == "Main CRM Import"
        assert transformed["research_status"] == "Not Started"

    def test_transform_minimal_record(self, sample_source_customer_minimal, batch_id):
        """Should handle minimal record without errors"""
        transformed = transform_customer_record(sample_source_customer_minimal, batch_id)

        assert transformed["company_name"] == "Smith Family"
        assert transformed["contact_name"] == ""
        assert transformed["email"] == []
        assert transformed["phone_number"] == []
        assert transformed["number_of_jobs"] == "0"
        assert transformed["priority_tier"] == "Unrated"

    def test_transform_invalid_job_count(self, batch_id):
        """Should handle invalid job count gracefully"""
        record = {
            "title": "Test Company",
            "s4b7a3f28a": "invalid",  # Invalid number
            "sffaeae042": {"count": 0, "items": []}
        }
        transformed = transform_customer_record(record, batch_id)
        assert transformed["number_of_jobs"] == "0"
        assert transformed["priority_tier"] == "Unrated"

    def test_transform_none_job_count(self, batch_id):
        """Should handle None job count"""
        record = {
            "title": "Test Company",
            "s4b7a3f28a": None,
            "sffaeae042": {"count": 0, "items": []}
        }
        transformed = transform_customer_record(record, batch_id)
        assert transformed["number_of_jobs"] == "0"

    def test_transform_email_merge(self, batch_id):
        """Should merge contact email with followup emails"""
        record = {
            "title": "Test Company",
            "s4b7a3f28a": "1",
            "sdaea1a4ce": ["followup@test.com"],  # Followup email
            "sffaeae042": {
                "count": 1,
                "items": [{
                    "sd4f0d01f0": {"sys_root": "John Doe"},
                    "s080dbe686": ["john@test.com"],
                    "s8e9b74ad0": []
                }]
            }
        }
        transformed = transform_customer_record(record, batch_id)
        # Should have both emails
        assert "john@test.com" in transformed["email"]
        assert "followup@test.com" in transformed["email"]

    def test_transform_company_notes(self, sample_source_customer, batch_id):
        """Should include company notes as SmartDoc"""
        transformed = transform_customer_record(sample_source_customer, batch_id)
        assert "quick_notes" in transformed
        assert "data" in transformed["quick_notes"]
        assert "html" in transformed["quick_notes"]


class TestBatchTransformRecords:
    """Test batch transformation"""

    def test_batch_transform_multiple_records(self, sample_source_customer, batch_id):
        """Should transform multiple records"""
        records = [sample_source_customer] * 3
        transformed = batch_transform_records(records, batch_id)

        assert len(transformed) == 3
        for record in transformed:
            assert record["company_name"] == "Acme Dental Office"

    def test_batch_transform_empty_list(self, batch_id):
        """Should handle empty list"""
        transformed = batch_transform_records([], batch_id)
        assert transformed == []

    def test_batch_transform_with_errors(self, batch_id):
        """Should continue on errors and log them"""
        # Create one valid and one invalid record
        valid_record = {
            "title": "Valid Company",
            "s4b7a3f28a": "5",
            "sffaeae042": {"count": 0, "items": []}
        }
        invalid_record = {
            # Missing title - will cause issues but should be handled
            "s4b7a3f28a": "3"
        }

        records = [valid_record, invalid_record]
        transformed = batch_transform_records(records, batch_id)

        # Should have at least the valid record
        assert len(transformed) >= 1

    def test_batch_transform_mixed_quality(self, sample_source_customer,
                                          sample_source_customer_minimal, batch_id):
        """Should handle records with varying data quality"""
        records = [sample_source_customer, sample_source_customer_minimal]
        transformed = batch_transform_records(records, batch_id)

        assert len(transformed) == 2
        # First has full data
        assert transformed[0]["contact_name"] == "John Smith"
        # Second has minimal data
        assert transformed[1]["contact_name"] == ""
