#!/usr/bin/env python3
"""
Customer Sync Script
Syncs customer data from main CRM to Customer Intelligence Hub
WITHOUT overwriting manual edits (merge strategy)

Usage:
    python scripts/sync_customers.py [--dry-run] [--limit N]

Examples:
    python scripts/sync_customers.py --dry-run
    python scripts/sync_customers.py --limit 10
    python scripts/sync_customers.py
"""

import argparse
from datetime import datetime
from difflib import SequenceMatcher
from config import Config
from utils.smartsuite_api import SmartSuiteAPI
from utils.field_mapping import (
    create_batch_id,
    batch_transform_records,
    create_date_field,
)
from utils.logger import setup_logger

logger = setup_logger(__name__)


def fuzzy_match_company(
    source_name: str, existing_name: str, threshold: float = 0.8
) -> bool:
    """
    Fuzzy match company names to detect if they're the same

    Args:
        source_name: Company name from source (main CRM)
        existing_name: Company name from destination (Intelligence Hub)
        threshold: Similarity threshold (0-1), default 0.8 (80% match)

    Returns:
        True if names likely match
    """
    if not source_name or not existing_name:
        return source_name == existing_name

    # Normalize names
    src = source_name.lower().strip()
    dst = existing_name.lower().strip()

    # Exact match
    if src == dst:
        return True

    # Remove common suffixes
    for suffix in [
        " llc",
        " inc",
        " corp",
        " ltd",
        " co",
        " company",
        " office",
        " clinic",
    ]:
        if src.endswith(suffix):
            src = src[: -len(suffix)].strip()
        if dst.endswith(suffix):
            dst = dst[: -len(suffix)].strip()

    # Calculate similarity
    similarity = SequenceMatcher(None, src, dst).ratio()
    return similarity >= threshold


def determine_merge_action(field_name: str, source_value, existing_value) -> tuple:
    """
    Determine whether to update, preserve, or flag a field

    Args:
        field_name: Field name
        source_value: Value from source (main CRM)
        existing_value: Value from destination (Intelligence Hub)

    Returns:
        (action, new_value) where action is "UPDATE", "PRESERVE", or "FLAG"
    """
    # Never overwrite manually curated fields
    preserve_fields = {
        "industry_business_type",  # Manually classified
        "annual_revenue",  # Manually entered or from QB
        "notes_from_outreach",  # Outreach notes
        "outreach_status",  # Campaign tracking
        "calls_made",
        "calls_answered",
        "first_order_date",
        "second_order_date",
    }

    # Always update these
    update_fields = {"number_of_jobs", "completed_orders", "priority_tier"}

    # Merge fields (combine rather than replace)
    merge_fields = {"email", "phone_number", "contact_name"}

    # Decision logic
    if field_name in preserve_fields:
        # If destination already has value, preserve it
        if existing_value is not None and existing_value != "":
            return ("PRESERVE", existing_value)
        # If source has value and destination empty, use source
        elif source_value is not None and source_value != "":
            return ("UPDATE", source_value)
        else:
            return ("PRESERVE", existing_value)

    if field_name in update_fields:
        # Update if source is better (higher number)
        if isinstance(source_value, (int, float)) and isinstance(
            existing_value, (int, float)
        ):
            if source_value > existing_value:
                return ("UPDATE", source_value)
            else:
                return ("PRESERVE", existing_value)
        else:
            return ("UPDATE", source_value)

    if field_name in merge_fields:
        # Special handling for contact info - merge rather than replace
        if field_name == "email" and isinstance(existing_value, list):
            # Merge unique emails
            merged = list(set((existing_value or []) + (source_value or [])))
            return ("UPDATE", merged)
        # For other merges, preserve existing
        elif existing_value:
            return ("PRESERVE", existing_value)
        else:
            return ("UPDATE", source_value)

    # Default: preserve existing if present
    if existing_value is not None and existing_value != "":
        return ("PRESERVE", existing_value)
    else:
        return ("UPDATE", source_value)


def sync_record(source_record: dict, existing_record: dict) -> tuple:
    """
    Merge source record with existing record

    Args:
        source_record: Record from main CRM
        existing_record: Record from Intelligence Hub

    Returns:
        (merged_record, conflicts) where conflicts is list of flagged changes
    """
    merged = existing_record.copy()
    conflicts = []

    # Fields to sync
    sync_fields = {
        "number_of_jobs": "number_of_jobs",
        "priority_tier": "priority_tier",
        "contact_name": "contact_name",
        "email": "email",
        "phone_number": "phone_number",
        "website_url": "website_url",
        "industry_business_type": "industry_business_type",
    }

    for source_field, dest_field in sync_fields.items():
        source_value = source_record.get(source_field)
        existing_value = existing_record.get(dest_field)

        action, new_value = determine_merge_action(
            dest_field, source_value, existing_value
        )

        if action == "UPDATE":
            if new_value != existing_value:
                merged[dest_field] = new_value
                logger.debug(f"Updated {dest_field}: {existing_value} -> {new_value}")

        elif action == "FLAG":
            conflicts.append(
                {
                    "field": dest_field,
                    "existing": existing_value,
                    "source": source_value,
                    "action": "NEEDS REVIEW",
                }
            )
            logger.warning(
                f"Conflict on {dest_field}: {existing_value} vs {source_value}"
            )

    # Always update sync timestamp
    merged["last_synced_from_main_system"] = create_date_field(include_time=False)

    return merged, conflicts


def main():
    """Main sync logic"""
    parser = argparse.ArgumentParser(
        description="Sync customers from main CRM to Intelligence Hub (merge strategy)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate sync without actually updating records",
    )
    parser.add_argument(
        "--limit", type=int, help="Limit number of records to sync (for testing)"
    )
    args = parser.parse_args()

    dry_run = args.dry_run or Config.DRY_RUN

    logger.info("=" * 70)
    logger.info("CIV ENTERPRISES - CUSTOMER SYNC")
    logger.info("=" * 70)
    logger.info(f"Source Table: {Config.SOURCE_CUSTOMERS_TABLE_ID}")
    logger.info(f"Destination Table: {Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID}")
    logger.info(f"Dry Run: {dry_run}")
    logger.info(f"Merge Strategy: Preserve manual edits, update order data")
    if args.limit:
        logger.info(f"Limit: {args.limit} records")
    logger.info("=" * 70)

    # Initialize API client
    api = SmartSuiteAPI()

    # Step 1: Fetch source records
    logger.info("\n[1/4] Fetching customers from main CRM...")
    try:
        source_records = api.get_all_records(
            table_id=Config.SOURCE_CUSTOMERS_TABLE_ID, batch_size=100
        )
        logger.info(f"✓ Retrieved {len(source_records)} customers")
    except Exception as e:
        logger.error(f"✗ Failed to fetch customers: {e}")
        return 1

    if args.limit:
        source_records = source_records[: args.limit]
        logger.info(f"  Limited to {len(source_records)} records for testing")

    # Step 2: Fetch existing records from Intelligence Hub
    logger.info("\n[2/4] Fetching existing records from Intelligence Hub...")
    try:
        existing_records = api.get_all_records(
            table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID, batch_size=100
        )
        logger.info(f"✓ Retrieved {len(existing_records)} existing records")
    except Exception as e:
        logger.error(f"✗ Failed to fetch existing records: {e}")
        return 1

    # Step 3: Match and merge
    logger.info("\n[3/4] Matching and merging records...")
    logger.info(
        f"  Matching {len(source_records)} source records against {len(existing_records)} existing..."
    )

    updates = []
    conflicts_log = []
    matched_count = 0
    unmatched_count = 0

    for source_record in source_records:
        source_name = source_record.get("title", "")
        matched = False

        # Try to find matching record by fuzzy match
        for existing_record in existing_records:
            existing_name = existing_record.get("company_name", "")

            if fuzzy_match_company(source_name, existing_name):
                # Found a match - merge the records
                merged_record, conflicts = sync_record(source_record, existing_record)

                if conflicts:
                    conflicts_log.extend(
                        [
                            {
                                "company_name": existing_name,
                                "record_id": existing_record.get("id"),
                                **conflict,
                            }
                            for conflict in conflicts
                        ]
                    )

                updates.append(merged_record)
                matched_count += 1
                matched = True
                logger.debug(f"Matched: {source_name}")
                break

        if not matched:
            unmatched_count += 1
            logger.debug(f"No match found: {source_name}")

    logger.info(f"✓ Matched {matched_count} records")
    logger.info(f"  Unmatched: {unmatched_count} (will not update)")

    # Step 4: Apply updates
    if dry_run:
        logger.info("\n[4/4] DRY RUN - Skipping actual updates")
        logger.info(f"  Would update: {len(updates)} records")
        if conflicts_log:
            logger.info(f"  Conflicts to review: {len(conflicts_log)}")
            logger.info("\n  Conflicts:")
            for conflict in conflicts_log[:10]:
                logger.info(
                    f"    {conflict['company_name']}: {conflict['field']} - {conflict['action']}"
                )
            if len(conflicts_log) > 10:
                logger.info(f"    ... and {len(conflicts_log) - 10} more")
        logger.info("\n✓ Dry run completed successfully")
    else:
        logger.info("\n[4/4] Applying updates to Intelligence Hub...")
        if updates:
            try:
                # Update records (batched, using PATCH for partial update)
                updated = 0
                for record in updates:
                    record_id = record.pop("id")
                    try:
                        api.update_record(
                            table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID,
                            record_id=record_id,
                            record_data=record,
                            partial=True,  # Use PATCH to avoid overwriting unmapped fields
                        )
                        updated += 1
                    except Exception as e:
                        logger.error(f"Failed to update record {record_id}: {e}")

                logger.info(f"✓ Updated {updated} records")
            except Exception as e:
                logger.error(f"✗ Failed to apply updates: {e}")
                return 1
        else:
            logger.info("  No matching records to update")

    # Log conflicts
    if conflicts_log:
        logger.warning(
            f"\n⚠ {len(conflicts_log)} conflicts found - review logs/sync_conflicts.log"
        )
        with open("logs/sync_conflicts.log", "w") as f:
            f.write("SYNC CONFLICTS REPORT\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 70 + "\n\n")
            for conflict in conflicts_log:
                f.write(f"Company: {conflict['company_name']}\n")
                f.write(f"Record ID: {conflict['record_id']}\n")
                f.write(f"Field: {conflict['field']}\n")
                f.write(f"Existing: {conflict['existing']}\n")
                f.write(f"Source: {conflict['source']}\n")
                f.write(f"Action: {conflict['action']}\n")
                f.write("-" * 70 + "\n\n")

    # Final summary
    logger.info("\n" + "=" * 70)
    logger.info("SYNC COMPLETED")
    logger.info("=" * 70)
    logger.info(f"Records processed: {len(source_records)}")
    logger.info(f"Records matched: {matched_count}")
    logger.info(f"Records updated: {len(updates)}")
    logger.info(f"Conflicts flagged: {len(conflicts_log)}")
    logger.info(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)

    return 0


if __name__ == "__main__":
    exit(main())
