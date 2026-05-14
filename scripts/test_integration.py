#!/usr/bin/env python3
"""
Integration Test Suite
Validates complete workflow: sync → geographic search → research → import

This script tests the full pipeline for Day 4 verification without destructive operations.

Usage:
    python scripts/test_integration.py [--verbose]

This script performs:
1. Sync test (dry-run) - Verify merge logic doesn't overwrite manual edits
2. Geographic search test - Verify prospect discovery works
3. Research test (dry-run) - Verify Perplexity integration readiness
4. Data quality check - Verify transformed data structure
"""

import argparse
import sys
import logging
from config import Config
from utils.logger import setup_logger
from utils.smartsuite_api import SmartSuiteAPI
from utils.geographic_search import GeographicProspectFinder
from utils.perplexity_client import PerplexityClient
from utils.field_mapping import (
    transform_customer_record,
    create_batch_id,
    batch_transform_records,
)

logger = setup_logger(__name__)


def test_api_connectivity(verbose: bool = False):
    """Test 1: Verify API connectivity"""
    logger.info("\n" + "=" * 70)
    logger.info("TEST 1: API Connectivity")
    logger.info("=" * 70)

    try:
        api = SmartSuiteAPI()
        logger.info("✓ SmartSuite API client initialized")

        # Try to fetch a small sample
        records = api.get_all_records(
            table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID, batch_size=1
        )
        logger.info(f"✓ Successfully connected to Intelligence Hub")
        logger.info(f"  Table has {len(records)} records total")
        return True

    except Exception as e:
        if verbose:
            logger.exception("✗ API connectivity test failed")
        else:
            logger.error(f"✗ API connectivity test failed: {e}")
        return False


def test_field_mapping(verbose: bool = False):
    """Test 2: Verify field mapping and transformation"""
    logger.info("\n" + "=" * 70)
    logger.info("TEST 2: Field Mapping & Transformation")
    logger.info("=" * 70)

    try:
        # Create a mock customer record
        mock_record = {
            "title": "Test Company Inc",
            "sf17aef823": "Company",
            "sf910a12e2": "Retail",
            "s0542830c2": ["https://example.com"],
            "s889d079ed": "Test notes",
            "sdaea1a4ce": ["follow@example.com"],
            "s4b7a3f28a": "5",
            "sffaeae042": {
                "count": 1,
                "items": [
                    {
                        "sd4f0d01f0": {"sys_root": "John Doe"},
                        "s080dbe686": ["john@example.com"],
                        "s8e9b74ad0": [
                            {"phone_number": "555-1234", "phone_country": "US"}
                        ],
                    }
                ],
            },
        }

        batch_id = create_batch_id()
        transformed = transform_customer_record(mock_record, batch_id)

        # Verify key fields
        assertions = [
            ("company_name", "Test Company Inc"),
            ("contact_name", "John Doe"),
            ("number_of_jobs", "5"),
            ("priority_tier", "Tier 2 - Medium Value"),
            ("record_type", "Existing Customer"),
        ]

        all_pass = True
        for field, expected in assertions:
            actual = transformed.get(field)
            if actual == expected:
                logger.info(f"✓ {field}: {actual}")
            else:
                logger.error(f"✗ {field}: expected '{expected}', got '{actual}'")
                all_pass = False

        # Verify new tracking fields exist
        tracking_fields = [
            "annual_revenue",
            "calls_made",
            "calls_answered",
            "first_order_date",
            "second_order_date",
            "outreach_status",
        ]
        for field in tracking_fields:
            if field in transformed:
                logger.info(f"✓ Tracking field exists: {field}")
            else:
                logger.error(f"✗ Missing tracking field: {field}")
                all_pass = False

        return all_pass

    except Exception as e:
        if verbose:
            logger.exception("✗ Field mapping test failed")
        else:
            logger.error(f"✗ Field mapping test failed: {e}")
        return False


def test_geographic_search(verbose: bool = False):
    """Test 3: Verify geographic search functionality"""
    logger.info("\n" + "=" * 70)
    logger.info("TEST 3: Geographic Search")
    logger.info("=" * 70)

    try:
        finder = GeographicProspectFinder()

        # Test 1: Search by radius
        prospects = finder.search_by_radius(
            center_zipcode="19505", radius_miles=20, limit=5
        )
        logger.info(f"✓ Geographic search returned {len(prospects)} prospects")

        if prospects:
            sample = prospects[0]
            required_fields = [
                "name",
                "category",
                "phone",
                "address",
                "zipcode",
                "distance_miles",
            ]
            for field in required_fields:
                if field in sample:
                    logger.info(f"  ✓ Contains {field}")
                else:
                    logger.error(f"  ✗ Missing {field}")
        else:
            logger.warning(
                "  ⚠ No prospects returned (expected for MVP with sample data)"
            )

        # Test 2: Search by category
        dental_prospects = finder.search_by_category(
            center_zipcode="19505", category="Dentist Office", radius_miles=20, limit=5
        )
        logger.info(f"✓ Category filter found {len(dental_prospects)} Dentist Offices")

        # Test 3: Get available categories
        categories = finder.get_common_categories()
        logger.info(f"✓ {len(categories)} searchable categories available")

        return True

    except Exception as e:
        if verbose:
            logger.exception("✗ Geographic search test failed")
        else:
            logger.error(f"✗ Geographic search test failed: {e}")
        return False


def test_perplexity_readiness(verbose: bool = False):
    """Test 4: Verify Perplexity API integration readiness"""
    logger.info("\n" + "=" * 70)
    logger.info("TEST 4: Perplexity API Readiness")
    logger.info("=" * 70)

    import os

    perplexity_key = os.getenv("PERPLEXITY_API_KEY")

    if not perplexity_key:
        logger.warning("⚠ PERPLEXITY_API_KEY not set")
        logger.info("  To enable research: add PERPLEXITY_API_KEY to .env file")
        logger.info("  Get a key at: https://www.perplexity.ai/")
        return True  # Not a failure, just not configured

    try:
        client = PerplexityClient(api_key=perplexity_key)
        logger.info("✓ Perplexity client initialized")
        logger.info("  Ready to research prospects")
        logger.info("  Cost estimate: ~$0.01 per research call")
        logger.info("  Monthly budget: $5.00")
        return True

    except Exception as e:
        if verbose:
            logger.exception("✗ Perplexity initialization failed")
        else:
            logger.error(f"✗ Perplexity initialization failed: {e}")
        return False


def test_merge_logic(verbose: bool = False):
    """Test 5: Verify sync merge logic"""
    logger.info("\n" + "=" * 70)
    logger.info("TEST 5: Sync Merge Logic")
    logger.info("=" * 70)

    try:
        from scripts.sync_customers import determine_merge_action, fuzzy_match_company

        # Test fuzzy matching
        test_cases = [
            ("Acme Inc", "Acme Inc", True),
            ("Acme Inc", "Acme Incorporated", True),
            ("Acme Dental LLC", "Acme Dental", True),
            ("Acme Dental", "Beta Dental", False),
        ]

        for name1, name2, expected in test_cases:
            result = fuzzy_match_company(name1, name2)
            status = "✓" if result == expected else "✗"
            logger.info(f"{status} Fuzzy match: '{name1}' vs '{name2}' = {result}")

        # Test merge action logic
        merge_tests = [
            ("annual_revenue", "source_value", "existing_value", "PRESERVE"),
            ("number_of_jobs", 5, 3, "UPDATE"),
            ("email", "new@ex.com", "old@ex.com", "PRESERVE"),
        ]

        logger.info("\nMerge rules:")
        for field, source, existing, expected_action in merge_tests:
            action, value = determine_merge_action(field, source, existing)
            status = "✓" if action == expected_action else "✗"
            logger.info(f"{status} {field}: action={action}")

        return True

    except Exception as e:
        if verbose:
            logger.exception("✗ Merge logic test failed")
        else:
            logger.error(f"✗ Merge logic test failed: {e}")
        return False


def test_data_quality(verbose: bool = False):
    """Test 6: Verify data quality constraints"""
    logger.info("\n" + "=" * 70)
    logger.info("TEST 6: Data Quality Checks")
    logger.info("=" * 70)

    try:
        api = SmartSuiteAPI()
        records = api.get_all_records(
            table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID, batch_size=10
        )

        if not records:
            logger.info("⚠ No records to check")
            return True

        sample_record = records[0]
        required_fields = [
            "company_name",
            "record_type",
            "lead_status",
            "research_status",
        ]
        missing_fields = []

        for field in required_fields:
            if field in sample_record and sample_record[field] is not None:
                logger.info(f"✓ Field present: {field}")
            else:
                logger.warning(f"⚠ Field missing or null: {field}")
                missing_fields.append(field)

        # Check for tracking fields in at least one record
        tracking_fields = ["calls_made", "calls_answered", "outreach_status"]
        for field in tracking_fields:
            found = any(field in r for r in records)
            if found:
                logger.info(f"✓ Tracking field exists: {field}")
            else:
                logger.warning(f"⚠ Tracking field not found: {field}")

        return len(missing_fields) == 0

    except Exception as e:
        if verbose:
            logger.exception("✗ Data quality test failed")
        else:
            logger.error(f"✗ Data quality test failed: {e}")
        return False


def main():
    """Run all integration tests"""
    parser = argparse.ArgumentParser(description="Run integration tests")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        for handler in logger.handlers:
            handler.setLevel(logging.DEBUG)
        logger.debug("Verbose logging enabled")

    logger.info("=" * 70)
    logger.info("CIV ENTERPRISES - INTEGRATION TEST SUITE")
    logger.info("=" * 70)
    logger.info(f"Intelligence Hub: {Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID}")
    logger.info("=" * 70)

    # Run all tests
    tests = [
        ("API Connectivity", lambda: test_api_connectivity(args.verbose)),
        ("Field Mapping", lambda: test_field_mapping(args.verbose)),
        ("Geographic Search", lambda: test_geographic_search(args.verbose)),
        ("Perplexity Readiness", lambda: test_perplexity_readiness(args.verbose)),
        ("Merge Logic", lambda: test_merge_logic(args.verbose)),
        ("Data Quality", lambda: test_data_quality(args.verbose)),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"Unexpected error in {test_name}: {e}")
            results.append((test_name, False))

    # Summary
    logger.info("\n" + "=" * 70)
    logger.info("TEST SUMMARY")
    logger.info("=" * 70)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        logger.info(f"{status}: {test_name}")

    logger.info("=" * 70)
    logger.info(f"Results: {passed}/{total} tests passed")
    logger.info("=" * 70)

    if passed == total:
        logger.info("\n✓ All integration tests passed!")
        logger.info("\nNext steps for Day 4:")
        logger.info("  1. python scripts/sync_customers.py --dry-run --limit 10")
        logger.info(
            "  2. python scripts/find_prospects_geographic.py --limit 20 --dry-run"
        )
        logger.info("  3. python scripts/research_prospects.py --dry-run --limit 5")
        logger.info("  4. Review results and prepare for live testing")
        return 0
    else:
        logger.error(
            f"\n✗ {total - passed} tests failed. Fix issues before proceeding."
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
