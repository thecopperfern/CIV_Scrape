"""
SmartSuite API wrapper
Provides methods for interacting with SmartSuite REST API
"""
import requests
import time
from typing import Dict, List, Optional, Any
from config import Config
from utils.logger import setup_logger

logger = setup_logger(__name__)

class SmartSuiteAPI:
    """SmartSuite API client"""

    def __init__(self, api_key: str = None, account_id: str = None):
        self.api_key = api_key or Config.SMARTSUITE_API_KEY
        self.account_id = account_id or Config.SMARTSUITE_ACCOUNT_ID
        self.base_url = Config.SMARTSUITE_BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Token {self.api_key}",
            "Account-ID": self.account_id,
            "Content-Type": "application/json"
        })

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None,
        retries: int = 3
    ) -> Dict:
        """
        Make HTTP request to SmartSuite API with retry logic

        Args:
            method: HTTP method (GET, POST, PATCH, DELETE)
            endpoint: API endpoint (will be appended to base_url)
            data: Request body (for POST/PATCH)
            params: Query parameters
            retries: Number of retries on failure

        Returns:
            Response JSON

        Raises:
            requests.HTTPError: On HTTP error after retries exhausted
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        for attempt in range(retries):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    json=data,
                    params=params,
                    timeout=30
                )
                response.raise_for_status()

                # Handle 204 No Content
                if response.status_code == 204:
                    return {"success": True}

                return response.json()

            except requests.exceptions.HTTPError as e:
                logger.error(f"HTTP error on attempt {attempt + 1}: {e}")
                logger.error(f"Response: {e.response.text if e.response else 'No response'}")

                if attempt < retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    raise

            except requests.exceptions.RequestException as e:
                logger.error(f"Request error on attempt {attempt + 1}: {e}")
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise

    def get_table_schema(self, table_id: str) -> Dict:
        """Get table structure and field definitions"""
        logger.debug(f"Fetching schema for table {table_id}")
        return self._make_request("GET", f"applications/{table_id}/")

    def list_records(
        self,
        table_id: str,
        filter_dict: Dict = None,
        sort: List[Dict] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict:
        """
        List records from a table with optional filtering and sorting

        Args:
            table_id: Table ID
            filter_dict: Filter conditions
            sort: Sort configuration [{"field": "field_slug", "direction": "asc"}]
            limit: Records per request (max 1000)
            offset: Pagination offset

        Returns:
            Response with 'items', 'total', 'offset'
        """
        logger.debug(f"Listing records from table {table_id} (limit={limit}, offset={offset})")

        endpoint = f"applications/{table_id}/records/list/"
        data = {
            "filter": filter_dict or {},
            "sort": sort or []
        }
        params = {"limit": min(limit, 1000), "offset": offset}

        return self._make_request("POST", endpoint, data=data, params=params)

    def get_all_records(
        self,
        table_id: str,
        filter_dict: Dict = None,
        sort: List[Dict] = None,
        batch_size: int = 100
    ) -> List[Dict]:
        """
        Fetch ALL records from a table using pagination

        Args:
            table_id: Table ID
            filter_dict: Filter conditions
            sort: Sort configuration
            batch_size: Records per request

        Returns:
            List of all records
        """
        all_records = []
        offset = 0

        logger.info(f"Fetching all records from table {table_id}")

        while True:
            response = self.list_records(
                table_id=table_id,
                filter_dict=filter_dict,
                sort=sort,
                limit=batch_size,
                offset=offset
            )

            items = response.get("items", [])
            all_records.extend(items)

            logger.info(f"Fetched {len(items)} records (total so far: {len(all_records)})")

            # Check if we have more records
            total = response.get("total", 0)
            if len(all_records) >= total:
                break

            offset += batch_size

        logger.info(f"Retrieved {len(all_records)} total records")
        return all_records

    def create_record(self, table_id: str, record_data: Dict) -> Dict:
        """
        Create a single record

        Args:
            table_id: Table ID
            record_data: Record field data

        Returns:
            Created record
        """
        logger.debug(f"Creating record in table {table_id}")
        endpoint = f"applications/{table_id}/records/"
        return self._make_request("POST", endpoint, data=record_data)

    def create_bulk_records(self, table_id: str, records: List[Dict]) -> List[Dict]:
        """
        Create multiple records (up to 25 per request)

        Args:
            table_id: Table ID
            records: List of record data dictionaries

        Returns:
            List of created records
        """
        if len(records) > 25:
            raise ValueError("Cannot create more than 25 records in a single request")

        logger.info(f"Creating {len(records)} records in table {table_id}")
        endpoint = f"applications/{table_id}/records/"
        data = {"records": records}
        return self._make_request("POST", endpoint, data=data)

    def create_records_batched(self, table_id: str, records: List[Dict]) -> List[Dict]:
        """
        Create multiple records in batches of 25

        Args:
            table_id: Table ID
            records: List of record data dictionaries

        Returns:
            List of all created records
        """
        all_created = []
        batch_size = 25

        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            logger.info(f"Creating batch {i//batch_size + 1} ({len(batch)} records)")

            created = self.create_bulk_records(table_id, batch)
            all_created.extend(created)

            # Rate limiting - be nice to the API
            if i + batch_size < len(records):
                time.sleep(1)

        return all_created

    def update_record(
        self,
        table_id: str,
        record_id: str,
        record_data: Dict,
        partial: bool = True
    ) -> Dict:
        """
        Update a record

        Args:
            table_id: Table ID
            record_id: Record ID to update
            record_data: Updated field data
            partial: If True, use PATCH (partial update), else PUT (full replace)

        Returns:
            Updated record
        """
        logger.debug(f"Updating record {record_id} in table {table_id}")
        endpoint = f"applications/{table_id}/records/{record_id}/"
        method = "PATCH" if partial else "PUT"
        return self._make_request(method, endpoint, data=record_data)

    def delete_record(self, table_id: str, record_id: str) -> Dict:
        """Delete a single record"""
        logger.debug(f"Deleting record {record_id} from table {table_id}")
        endpoint = f"applications/{table_id}/records/{record_id}/"
        return self._make_request("DELETE", endpoint)
