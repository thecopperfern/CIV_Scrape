#!/usr/bin/env python3
"""
Geographic Prospect Discovery Script
Finds business prospects within a geographic radius of a ZIP code

Usage:
    python scripts/find_prospects_geographic.py [--zipcode ZIP] [--radius MILES] [--categories CAT1,CAT2] [--limit N] [--dry-run]

Examples:
    python scripts/find_prospects_geographic.py --zipcode 19505 --radius 20 --limit 50 --dry-run
    python scripts/find_prospects_geographic.py --radius 25 --categories "Dentist Office,Medical/Healthcare Office"
    python scripts/find_prospects_geographic.py --limit 100
"""

import argparse
import csv
import os
from datetime import datetime
from difflib import SequenceMatcher
from config import Config
from utils.geographic_search import GeographicProspectFinder
from utils.smartsuite_api import SmartSuiteAPI
from utils.field_mapping import (
    create_batch_id,
    create_date_field,
    create_smartdoc,
    calculate_priority_tier,
)
from utils.logger import setup_logger

logger = setup_logger(__name__)


def fuzzy_match_prospect(
    source_name: str, existing_name: str, threshold: float = 0.8
) -> bool:
    """
    Fuzzy match business names to detect if they're the same

    Args:
        source_name: Business name from geographic search
        existing_name: Business name from Intelligence Hub
        threshold: Similarity threshold (0-1)

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
        " dental",
    ]:
        if src.endswith(suffix):
            src = src[: -len(suffix)].strip()
        if dst.endswith(suffix):
            dst = dst[: -len(suffix)].strip()

    # Calculate similarity
    similarity = SequenceMatcher(None, src, dst).ratio()
    return similarity >= threshold


def transform_geographic_prospect(
    prospect_data: dict, batch_id: str, source: str = "Geographic Search"
) -> dict:
    """
    Transform geographic search result to Intelligence Hub format

    Args:
        prospect_data: Prospect from geographic search
        batch_id: Import batch identifier
        source: Data source identifier

    Returns:
        Transformed record ready for insertion
    """
    company_name = prospect_data.get("name", "")
    category = prospect_data.get("category", "")
    phone = prospect_data.get("phone", "")
    website = prospect_data.get("website", "")
    address = prospect_data.get("address", "")
    zipcode = prospect_data.get("zipcode", "")
    distance = prospect_data.get("distance_miles", 0)

    # Map category to industry
    industry_mapping = {
        "Dentist Office": "Dentist Office",
        "Medical/Healthcare Office": "Medical/Healthcare Office",
        "Construction/Contractor": "Construction/Contractor",
        "Corporate Office": "Corporate Office",
        "Manufacturing": "Manufacturing",
        "Retail": "Retail",
        "Restaurant/Hospitality": "Restaurant/Hospitality",
        "Professional Services": "Professional Services",
        "Legal Services": "Legal Services",
        "Accounting/Finance": "Accounting/Finance",
        "Real Estate": "Real Estate",
        "Education": "Education",
        "Gym/Fitness": "Gym/Fitness",
        "Salon/Spa": "Salon/Spa",
        "Auto Services": "Auto Services",
    }

    industry = industry_mapping.get(category, "Other")

    # Format phone number if present
    phone_array = []
    if phone:
        phone_array = [
            {
                "phone_country": "US",
                "phone_number": phone,
                "phone_extension": "",
                "phone_type": 1,
            }
        ]

    # Format website
    website_url = ""
    if website:
        if not website.startswith("http"):
            website_url = f"https://{website}"
        else:
            website_url = website

    # Build notes about discovery
    discovery_notes = f"""Discovered via geographic search: {datetime.now().strftime('%Y-%m-%d')}

**Location**: {address}, {zipcode}
**Category**: {category}
**Distance**: {distance:.1f} miles from search center
**Source**: {source}

This prospect was discovered through geographic radius search and needs manual review and contact enrichment.
"""

    # Build transformed record
    transformed = {
        "record_type": "New Prospect",
        "import_batch_id": batch_id,
        "last_synced_from_main_system": create_date_field(include_time=False),
        "company_name": company_name,
        "contact_name": "",
        "email": [],
        "phone_number": phone_array,
        "industry_business_type": industry,
        "number_of_jobs": "0",
        "priority_tier": "Unrated",
        "website_url": website_url,
        "lead_status": "New Prospect",
        "lead_source": source,
        "research_status": "Not Started",
        "date_added": create_date_field(include_time=False),
        # Outreach tracking fields (initialized to defaults)
        "annual_revenue": 0,
        "calls_made": 0,
        "calls_answered": 0,
        "first_order_date": None,
        "second_order_date": None,
        "outreach_status": "Not Started",
        "quick_notes": create_smartdoc(discovery_notes),
        "notes_from_outreach": create_smartdoc(""),
        "zipcode": zipcode,
    }

    return transformed


def main():
    """Main geographic discovery workflow"""
    parser = argparse.ArgumentParser(
        description="Find business prospects within geographic radius"
    )
    parser.add_argument(
        "--zipcode", default="19505", help="Center ZIP code (default 19505)"
    )
    parser.add_argument(
        "--radius", type=float, default=20, help="Search radius in miles (default 20)"
    )
    parser.add_argument(
        "--categories",
        help="Comma-separated list of categories (e.g., 'Dentist Office,Medical/Healthcare Office')",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Limit number of prospects to find (default 50)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview results without importing"
    )
    parser.add_argument("--output-csv", help="Save results to CSV file")
    args = parser.parse_args()

    dry_run = args.dry_run or Config.DRY_RUN

    logger.info("=" * 70)
    logger.info("CIV ENTERPRISES - GEOGRAPHIC PROSPECT DISCOVERY")
    logger.info("=" * 70)
    logger.info(f"Center ZIP Code: {args.zipcode}")
    logger.info(f"Search Radius: {args.radius} miles")
    logger.info(f"Dry Run: {dry_run}")
    logger.info(f"Limit: {args.limit} prospects")
    if args.categories:
        logger.info(f"Categories: {args.categories}")
    logger.info("=" * 70)

    # Parse categories if provided
    categories = None
    if args.categories:
        categories = [c.strip() for c in args.categories.split(",")]

    # Step 1: Geographic search
    logger.info(
        f"\n[1/3] Searching for prospects within {args.radius} miles of {args.zipcode}..."
    )

    finder = GeographicProspectFinder()
    prospects = finder.search_by_radius(
        center_zipcode=args.zipcode,
        radius_miles=args.radius,
        categories=categories,
        limit=args.limit,
    )

    logger.info(f"✓ Found {len(prospects)} prospects")

    if not prospects:
        logger.info(
            "No prospects found. Try adjusting ZIP code, radius, or categories."
        )
        return 0

    # Step 2: Deduplicate against existing records
    logger.info("\n[2/3] Deduplicating against existing customers and prospects...")

    api = SmartSuiteAPI()
    existing_records = api.get_all_records(
        table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID, batch_size=100
    )
    existing_names = [r.get("company_name", "") for r in existing_records]

    deduplicated = []
    duplicates = 0

    for prospect in prospects:
        prospect_name = prospect.get("name", "")
        is_duplicate = any(
            fuzzy_match_prospect(prospect_name, existing_name)
            for existing_name in existing_names
        )

        if is_duplicate:
            duplicates += 1
            logger.debug(f"Skipping duplicate: {prospect_name}")
        else:
            deduplicated.append(prospect)

    logger.info(f"✓ Deduplicated {duplicates} duplicates")
    logger.info(f"  Unique prospects: {len(deduplicated)}")

    if not deduplicated:
        logger.info("All prospects were duplicates. No new prospects to import.")
        return 0

    # Step 3: Import or preview
    batch_id = create_batch_id()
    logger.info(f"\n[3/3] Processing {len(deduplicated)} new prospects...")

    # Transform prospects to Intelligence Hub format
    transformed = []
    for prospect in deduplicated:
        try:
            transformed_prospect = transform_geographic_prospect(prospect, batch_id)
            transformed.append(transformed_prospect)
        except Exception as e:
            logger.error(f"Error transforming prospect {prospect.get('name')}: {e}")

    logger.info(f"✓ Transformed {len(transformed)} prospects")

    # Save to CSV if requested
    if args.output_csv:
        logger.info(f"\nSaving to CSV: {args.output_csv}")
        try:
            with open(args.output_csv, "w", newline="", encoding="utf-8") as f:
                if transformed:
                    writer = csv.DictWriter(f, fieldnames=transformed[0].keys())
                    writer.writeheader()
                    writer.writerows(transformed)
            logger.info(f"✓ Saved {len(transformed)} prospects to {args.output_csv}")
        except Exception as e:
            logger.error(f"Failed to save CSV: {e}")

    # Import to Intelligence Hub
    if dry_run:
        logger.info("\n[DRY-RUN] Would import the following prospects:")
        for prospect in transformed[:5]:
            logger.info(
                f"  - {prospect['company_name']} ({prospect['industry_business_type']})"
            )
        if len(transformed) > 5:
            logger.info(f"  ... and {len(transformed) - 5} more")
    else:
        logger.info(f"\nImporting {len(transformed)} prospects to Intelligence Hub...")
        imported = 0
        failed = 0

        for i, prospect in enumerate(transformed, 1):
            try:
                api.create_record(
                    table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID,
                    record_data=prospect,
                )
                imported += 1
                logger.debug(
                    f"[{i}/{len(transformed)}] Imported: {prospect['company_name']}"
                )
            except Exception as e:
                failed += 1
                logger.error(f"Failed to import {prospect['company_name']}: {e}")

        logger.info(f"✓ Imported {imported} prospects")
        if failed > 0:
            logger.warning(f"⚠ Failed to import {failed} prospects")

    # Final summary
    logger.info("\n" + "=" * 70)
    logger.info("GEOGRAPHIC DISCOVERY COMPLETED")
    logger.info("=" * 70)
    logger.info(f"Initial search: {len(prospects)} prospects")
    logger.info(f"After deduplication: {len(deduplicated)} unique prospects")
    logger.info(f"Batch ID: {batch_id}")
    logger.info(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)
    logger.info(f"\nNext steps:")
    logger.info(f"  1. Review imported prospects in Intelligence Hub")
    logger.info(
        f"  2. Run: python scripts/research_prospects.py --limit {min(20, len(deduplicated))}"
    )
    logger.info(f"  3. Review research quality")
    logger.info(f"  4. Start outreach campaigns")
    logger.info("=" * 70)

    print(
        f'RESULT_JSON {{"prospects_found": {len(deduplicated)}, "enrichments_done": 0}}'
    )
    return 0


if __name__ == "__main__":
    exit(main())
