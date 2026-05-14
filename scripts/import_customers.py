#!/usr/bin/env python3
"""
Customer Import Script
Imports existing customers from main CRM to Customer Intelligence Hub

Usage:
    python scripts/import_customers.py [--dry-run] [--limit N]

Examples:
    python scripts/import_customers.py --dry-run
    python scripts/import_customers.py --limit 10
    python scripts/import_customers.py
"""

import argparse
from datetime import datetime
from config import Config
from utils.smartsuite_api import SmartSuiteAPI
from utils.field_mapping import create_batch_id, batch_transform_records
from utils.logger import setup_logger

logger = setup_logger(__name__)


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Import customers from main CRM to Customer Intelligence Hub"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate import without actually creating records",
    )
    parser.add_argument(
        "--limit", type=int, help="Limit number of records to import (for testing)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=Config.IMPORT_BATCH_SIZE,
        help=f"Number of records per batch (default: {Config.IMPORT_BATCH_SIZE})",
    )
    return parser.parse_args()


def main():
    """Main import logic"""
    args = parse_args()

    # Override config with CLI args
    dry_run = args.dry_run or Config.DRY_RUN

    logger.info("=" * 70)
    logger.info("CIV ENTERPRISES - CUSTOMER IMPORT")
    logger.info("=" * 70)
    logger.info(f"Source Table: {Config.SOURCE_CUSTOMERS_TABLE_ID}")
    logger.info(f"Destination Table: {Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID}")
    logger.info(f"Dry Run: {dry_run}")
    logger.info(f"Batch Size: {args.batch_size}")
    if args.limit:
        logger.info(f"Limit: {args.limit} records")
    logger.info("=" * 70)

    # Initialize API client
    api = SmartSuiteAPI()

    # Step 1: Fetch existing customers
    logger.info("\n[1/4] Fetching existing customers from main CRM...")
    try:
        source_records = api.get_all_records(
            table_id=Config.SOURCE_CUSTOMERS_TABLE_ID, batch_size=100
        )
        logger.info(f"✓ Retrieved {len(source_records)} customers")
    except Exception as e:
        logger.error(f"✗ Failed to fetch customers: {e}")
        return 1

    # Apply limit if specified
    if args.limit:
        source_records = source_records[: args.limit]
        logger.info(f"  Limited to {len(source_records)} records for testing")

    # Step 2: Transform records
    logger.info("\n[2/4] Transforming customer data...")
    batch_id = create_batch_id()
    logger.info(f"  Import Batch ID: {batch_id}")

    try:
        transformed_records = batch_transform_records(source_records, batch_id)
        logger.info(f"✓ Transformed {len(transformed_records)} records")
    except Exception as e:
        logger.error(f"✗ Transformation failed: {e}")
        return 1

    # Step 3: Analyze what we're about to import
    logger.info("\n[3/4] Import Summary:")
    logger.info(f"  Total Records: {len(transformed_records)}")

    # Count by priority tier
    tier_counts = {}
    for record in transformed_records:
        tier = record.get("priority_tier", "Unrated")
        tier_counts[tier] = tier_counts.get(tier, 0) + 1

    logger.info("  Priority Breakdown:")
    for tier, count in sorted(tier_counts.items()):
        logger.info(f"    {tier}: {count}")

    # Count with/without contact info
    with_contact = sum(1 for r in transformed_records if r.get("contact_name"))
    with_email = sum(1 for r in transformed_records if r.get("email"))
    with_phone = sum(1 for r in transformed_records if r.get("phone_number"))

    logger.info("  Contact Info:")
    logger.info(f"    With Contact Name: {with_contact}")
    logger.info(f"    With Email: {with_email}")
    logger.info(f"    With Phone: {with_phone}")

    # Step 4: Create records
    if dry_run:
        logger.info("\n[4/4] DRY RUN - Skipping actual import")
        logger.info("  Would have created the following records:")
        for i, record in enumerate(transformed_records[:5], 1):
            logger.info(
                f"    {i}. {record['company_name']} ({record['priority_tier']})"
            )
        if len(transformed_records) > 5:
            logger.info(f"    ... and {len(transformed_records) - 5} more")
        logger.info("\n✓ Dry run completed successfully")
        return 0

    logger.info("\n[4/4] Creating records in Customer Intelligence Hub...")
    try:
        created_records = api.create_records_batched(
            table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID,
            records=transformed_records,
        )
        logger.info(f"✓ Successfully created {len(created_records)} records")
    except Exception as e:
        logger.error(f"✗ Failed to create records: {e}")
        return 1

    # Final summary
    logger.info("\n" + "=" * 70)
    logger.info("IMPORT COMPLETED SUCCESSFULLY")
    logger.info("=" * 70)
    logger.info(f"Batch ID: {batch_id}")
    logger.info(f"Records Imported: {len(created_records)}")
    logger.info(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)

    return 0


if __name__ == "__main__":
    exit(main())
