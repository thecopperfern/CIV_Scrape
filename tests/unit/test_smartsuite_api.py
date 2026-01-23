"""
Unit tests for utils/smartsuite_api.py
Tests API wrapper with mocked HTTP requests
"""
import pytest
import responses
from requests.exceptions import HTTPError, RequestException
from utils.smartsuite_api import SmartSuiteAPI
from config import Config


class TestSmartSuiteAPIInitialization:
    """Test API client initialization"""

    def test_init_with_defaults(self):
        """Should initialize with config defaults"""
        api = SmartSuiteAPI()
        assert api.api_key == Config.SMARTSUITE_API_KEY
        assert api.account_id == Config.SMARTSUITE_ACCOUNT_ID
        assert api.base_url == Config.SMARTSUITE_BASE_URL

    def test_init_with_custom_credentials(self):
        """Should accept custom credentials"""
        api = SmartSuiteAPI(api_key="custom_key", account_id="custom_account")
        assert api.api_key == "custom_key"
        assert api.account_id == "custom_account"

    def test_session_headers(self):
        """Should set correct headers on session"""
        api = SmartSuiteAPI()
        headers = api.session.headers
        assert headers["Authorization"] == f"Token {Config.SMARTSUITE_API_KEY}"
        assert headers["Account-ID"] == Config.SMARTSUITE_ACCOUNT_ID
        assert headers["Content-Type"] == "application/json"


class TestSmartSuiteAPIGetTableSchema:
    """Test get_table_schema method"""

    @responses.activate
    def test_get_table_schema_success(self):
        """Should fetch table schema successfully"""
        table_id = "test_table_123"
        mock_schema = {
            "id": table_id,
            "name": "Test Table",
            "structure": []
        }

        responses.add(
            responses.GET,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/",
            json=mock_schema,
            status=200
        )

        api = SmartSuiteAPI()
        schema = api.get_table_schema(table_id)

        assert schema == mock_schema
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_table_schema_not_found(self):
        """Should raise error on 404"""
        table_id = "nonexistent_table"

        responses.add(
            responses.GET,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/",
            json={"error": "Not found"},
            status=404
        )

        api = SmartSuiteAPI()
        with pytest.raises(HTTPError):
            api.get_table_schema(table_id)


class TestSmartSuiteAPIListRecords:
    """Test list_records method"""

    @responses.activate
    def test_list_records_success(self, mock_api_response_list_records):
        """Should list records successfully"""
        table_id = "test_table"

        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json=mock_api_response_list_records,
            status=200
        )

        api = SmartSuiteAPI()
        result = api.list_records(table_id)

        assert result == mock_api_response_list_records
        assert len(result["items"]) == 3

    @responses.activate
    def test_list_records_with_filter(self):
        """Should send filter in request"""
        table_id = "test_table"
        filter_dict = {"field": "value"}

        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json={"items": [], "total": 0},
            status=200
        )

        api = SmartSuiteAPI()
        api.list_records(table_id, filter_dict=filter_dict)

        # Check request body
        assert len(responses.calls) == 1
        request_body = responses.calls[0].request.body
        assert b'"filter"' in request_body

    @responses.activate
    def test_list_records_with_pagination(self):
        """Should handle pagination parameters"""
        table_id = "test_table"

        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json={"items": [], "total": 0, "offset": 50},
            status=200
        )

        api = SmartSuiteAPI()
        result = api.list_records(table_id, limit=50, offset=50)

        assert result["offset"] == 50


class TestSmartSuiteAPIGetAllRecords:
    """Test get_all_records method with pagination"""

    @responses.activate
    def test_get_all_records_single_page(self):
        """Should fetch all records in one request if total < limit"""
        table_id = "test_table"

        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json={"items": [{"id": "1"}, {"id": "2"}], "total": 2, "offset": 0},
            status=200
        )

        api = SmartSuiteAPI()
        records = api.get_all_records(table_id)

        assert len(records) == 2
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_all_records_multiple_pages(self):
        """Should paginate through all records"""
        table_id = "test_table"

        # First page
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json={"items": [{"id": "1"}, {"id": "2"}], "total": 4, "offset": 0},
            status=200
        )

        # Second page
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json={"items": [{"id": "3"}, {"id": "4"}], "total": 4, "offset": 2},
            status=200
        )

        api = SmartSuiteAPI()
        records = api.get_all_records(table_id, batch_size=2)

        assert len(records) == 4
        assert len(responses.calls) == 2

    @responses.activate
    def test_get_all_records_empty_table(self):
        """Should handle empty table"""
        table_id = "test_table"

        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json={"items": [], "total": 0, "offset": 0},
            status=200
        )

        api = SmartSuiteAPI()
        records = api.get_all_records(table_id)

        assert records == []


class TestSmartSuiteAPICreateRecord:
    """Test create_record method"""

    @responses.activate
    def test_create_record_success(self):
        """Should create single record"""
        table_id = "test_table"
        record_data = {"company_name": "Test Company"}
        created_record = {"id": "new_123", **record_data}

        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/",
            json=created_record,
            status=201
        )

        api = SmartSuiteAPI()
        result = api.create_record(table_id, record_data)

        assert result["id"] == "new_123"
        assert result["company_name"] == "Test Company"


class TestSmartSuiteAPICreateBulkRecords:
    """Test create_bulk_records method"""

    @responses.activate
    def test_create_bulk_records_success(self):
        """Should create multiple records"""
        table_id = "test_table"
        records = [
            {"company_name": "Company 1"},
            {"company_name": "Company 2"}
        ]
        created_records = [
            {"id": "rec_1", "company_name": "Company 1"},
            {"id": "rec_2", "company_name": "Company 2"}
        ]

        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/",
            json=created_records,
            status=201
        )

        api = SmartSuiteAPI()
        result = api.create_bulk_records(table_id, records)

        assert len(result) == 2

    def test_create_bulk_records_too_many(self):
        """Should raise error if more than 25 records"""
        api = SmartSuiteAPI()
        records = [{"name": f"Record {i}"} for i in range(26)]

        with pytest.raises(ValueError, match="Cannot create more than 25 records"):
            api.create_bulk_records("test_table", records)


class TestSmartSuiteAPICreateRecordsBatched:
    """Test create_records_batched method"""

    @responses.activate
    def test_create_records_batched_single_batch(self):
        """Should handle records within single batch"""
        table_id = "test_table"
        records = [{"name": f"Record {i}"} for i in range(10)]

        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/",
            json=[{"id": f"rec_{i}"} for i in range(10)],
            status=201
        )

        api = SmartSuiteAPI()
        result = api.create_records_batched(table_id, records)

        assert len(result) == 10
        assert len(responses.calls) == 1

    @responses.activate
    def test_create_records_batched_multiple_batches(self):
        """Should split into multiple batches of 25"""
        table_id = "test_table"
        records = [{"name": f"Record {i}"} for i in range(60)]

        # Mock 3 batch responses (25 + 25 + 10)
        for i in range(3):
            batch_size = 25 if i < 2 else 10
            responses.add(
                responses.POST,
                f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/",
                json=[{"id": f"rec_{j}"} for j in range(batch_size)],
                status=201
            )

        api = SmartSuiteAPI()
        result = api.create_records_batched(table_id, records)

        assert len(result) == 60
        assert len(responses.calls) == 3


class TestSmartSuiteAPIUpdateRecord:
    """Test update_record method"""

    @responses.activate
    def test_update_record_patch(self):
        """Should update record with PATCH (partial)"""
        table_id = "test_table"
        record_id = "rec_123"
        update_data = {"status": "active"}
        updated_record = {"id": record_id, "status": "active"}

        responses.add(
            responses.PATCH,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/{record_id}/",
            json=updated_record,
            status=200
        )

        api = SmartSuiteAPI()
        result = api.update_record(table_id, record_id, update_data)

        assert result["status"] == "active"

    @responses.activate
    def test_update_record_put(self):
        """Should update record with PUT (full replace)"""
        table_id = "test_table"
        record_id = "rec_123"
        update_data = {"name": "New Name", "status": "active"}

        responses.add(
            responses.PUT,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/{record_id}/",
            json=update_data,
            status=200
        )

        api = SmartSuiteAPI()
        result = api.update_record(table_id, record_id, update_data, partial=False)

        assert result["name"] == "New Name"


class TestSmartSuiteAPIDeleteRecord:
    """Test delete_record method"""

    @responses.activate
    def test_delete_record_success(self):
        """Should delete record"""
        table_id = "test_table"
        record_id = "rec_123"

        responses.add(
            responses.DELETE,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/{record_id}/",
            status=204
        )

        api = SmartSuiteAPI()
        result = api.delete_record(table_id, record_id)

        assert result["success"] is True


class TestSmartSuiteAPIRetryLogic:
    """Test retry logic and error handling"""

    @responses.activate
    def test_retry_on_500_then_success(self):
        """Should retry on 500 error and succeed"""
        table_id = "test_table"

        # First call fails
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json={"error": "Server error"},
            status=500
        )

        # Second call succeeds
        responses.add(
            responses.POST,
            f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
            json={"items": [], "total": 0},
            status=200
        )

        api = SmartSuiteAPI()
        result = api.list_records(table_id)

        assert result["total"] == 0
        assert len(responses.calls) == 2

    @responses.activate
    def test_retry_exhausted(self):
        """Should raise error after retries exhausted"""
        table_id = "test_table"

        # All calls fail
        for _ in range(3):
            responses.add(
                responses.POST,
                f"{Config.SMARTSUITE_BASE_URL}/applications/{table_id}/records/list/",
                json={"error": "Server error"},
                status=500
            )

        api = SmartSuiteAPI()
        with pytest.raises(HTTPError):
            api.list_records(table_id)

        assert len(responses.calls) == 3
