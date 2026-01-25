#!/usr/bin/env python3
"""
Research Prospects Script
Uses Perplexity API to research prospects and enrich them with company information

Usage:
    python scripts/research_prospects.py [--dry-run] [--limit N] [--status STATUS]

Examples:
    python scripts/research_prospects.py --dry-run --limit 5
    python scripts/research_prospects.py --limit 20
    python scripts/research_prospects.py --status "Not Started"
"""
import argparse
import os
from datetime import datetime
from config import Config
from utils.smartsuite_api import SmartSuiteAPI
from utils.perplexity_client import PerplexityClient
from utils.field_mapping import create_smartdoc, create_date_field
from utils.logger import setup_logger

logger = setup_logger(__name__)


def research_and_update_prospect(
    api: SmartSuiteAPI,
    perplexity: PerplexityClient,
    prospect_record: dict,
    dry_run: bool = False
) -> dict:
    """
    Research a prospect and update their record

    Args:
        api: SmartSuite API client
        perplexity: Perplexity API client
        prospect_record: Prospect record from Intelligence Hub
        dry_run: If True, don't actually update records

    Returns:
        Dictionary with research results and update status
    """
    prospect_id = prospect_record.get("id")
    company_name = prospect_record.get("company_name", "Unknown")
    zipcode = prospect_record.get("zipcode", "")

    logger.debug(f"Researching: {company_name}")

    result = {
        "prospect_id": prospect_id,
        "company_name": company_name,
        "success": False,
        "research_data": {},
        "updated_fields": [],
        "errors": []
    }

    try:
        # Research the company
        research = perplexity.research_company(
            company_name=company_name,
            zipcode=zipcode,
            search_type="comprehensive"
        )

        if not research.get("success"):
            result["errors"].append("Perplexity API research failed")
            logger.warning(f"Failed to research {company_name}: API returned no data")
            return result

        result["research_data"] = research

        # Build update payload with enriched data
        update_payload = {
            "research_status": "Completed",
            "last_researched": create_date_field(include_time=True)
        }

        # Add phone number if found and not already present
        if research.get("phone_number") and not prospect_record.get("phone_number"):
            phone_obj = {
                "phone_country": "US",
                "phone_number": research["phone_number"],
                "phone_extension": "",
                "phone_type": 1
            }
            update_payload["phone_number"] = [phone_obj]
            result["updated_fields"].append("phone_number")

        # Add email if found and not already present
        if research.get("email"):
            existing_emails = prospect_record.get("email", [])
            if research["email"] not in existing_emails:
                all_emails = existing_emails + [research["email"]]
                update_payload["email"] = all_emails
                result["updated_fields"].append("email")

        # Add website if found and not already present
        if research.get("website") and not prospect_record.get("website_url"):
            update_payload["website_url"] = research["website"]
            result["updated_fields"].append("website_url")

        # Add industry if not yet classified
        if research.get("industry") and prospect_record.get("industry_business_type") == "Other":
            update_payload["industry_business_type"] = research["industry"]
            result["updated_fields"].append("industry_business_type")

        # Add research notes with all extracted data
        research_notes = f"""Research completed: {datetime.now().strftime('%Y-%m-%d %H:%M')}

**Confidence**: {research.get('confidence', 0):.0%}
**Employee Count**: {research.get('employee_count', 'Unknown')}
**Industry**: {research.get('industry', 'Unknown')}

**Business Signals**:
{chr(10).join(f"- {signal}" for signal in research.get("signals", [])) or "- None detected"}

**Research Details**:
{research.get("raw_research", "No details captured")}
"""
        update_payload["quick_notes"] = create_smartdoc(research_notes)
        result["updated_fields"].append("quick_notes")

        # Apply update
        if not dry_run:
            try:
                api.update_record(
                    table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID,
                    record_id=prospect_id,
                    record_data=update_payload,
                    partial=True
                )
                result["success"] = True
                logger.info(f"✓ Researched and updated: {company_name}")
                logger.debug(f"  Updated fields: {', '.join(result['updated_fields'])}")
            except Exception as e:
                result["errors"].append(f"Failed to update record: {str(e)}")
                logger.error(f"Failed to update {company_name}: {e}")
        else:
            result["success"] = True
            logger.info(f"[DRY-RUN] Would research and update: {company_name}")
            logger.debug(f"  Would update fields: {', '.join(result['updated_fields'])}")

    except Exception as e:
        result["errors"].append(str(e))
        logger.error(f"Error researching {company_name}: {e}")

    return result


def main():
    """Main research workflow"""
    parser = argparse.ArgumentParser(
        description="Research prospects using Perplexity API and enrich with company data"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate research without updating records"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Limit number of prospects to research (default 10)"
    )
    parser.add_argument(
        "--status",
        default="Not Started",
        help="Only research prospects with this research status (default 'Not Started')"
    )
    args = parser.parse_args()

    dry_run = args.dry_run or Config.DRY_RUN

    # Check Perplexity API key
    perplexity_api_key = os.getenv("PERPLEXITY_API_KEY")
    if not perplexity_api_key and not dry_run:
        logger.error("PERPLEXITY_API_KEY environment variable not set")
        logger.info("Set it in .env: PERPLEXITY_API_KEY=your_key_here")
        logger.info("Get a key at: https://www.perplexity.ai/")
        return 1

    logger.info("=" * 70)
    logger.info("CIV ENTERPRISES - PROSPECT RESEARCH")
    logger.info("=" * 70)
    logger.info(f"Table: {Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID}")
    logger.info(f"Dry Run: {dry_run}")
    logger.info(f"Limit: {args.limit} prospects")
    logger.info(f"Filter: research_status = '{args.status}'")
    logger.info("=" * 70)

    # Initialize clients
    api = SmartSuiteAPI()
    perplexity = PerplexityClient(api_key=perplexity_api_key) if perplexity_api_key else None

    # Step 1: Fetch prospects needing research
    logger.info("\n[1/3] Fetching prospects from Intelligence Hub...")
    try:
        all_prospects = api.get_all_records(
            table_id=Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID,
            batch_size=100
        )

        # Filter by research status
        prospects_to_research = [
            p for p in all_prospects
            if p.get("research_status") == args.status
        ]

        logger.info(f"✓ Retrieved {len(all_prospects)} total prospects")
        logger.info(f"  {len(prospects_to_research)} need research (status: '{args.status}')")

        if args.limit:
            prospects_to_research = prospects_to_research[:args.limit]
            logger.info(f"  Limited to {len(prospects_to_research)} for this run")

    except Exception as e:
        logger.error(f"✗ Failed to fetch prospects: {e}")
        return 1

    if not prospects_to_research:
        logger.info("✓ No prospects to research")
        return 0

    # Step 2: Research prospects
    logger.info(f"\n[2/3] Researching {len(prospects_to_research)} prospects...")

    if dry_run:
        logger.info("[DRY-RUN] Simulating research without API calls...")

    results = []
    successful = 0
    failed = 0
    api_cost_estimate = 0.0

    for i, prospect in enumerate(prospects_to_research, 1):
        company_name = prospect.get("company_name", "Unknown")
        logger.info(f"  [{i}/{len(prospects_to_research)}] {company_name}...")

        if dry_run:
            # In dry-run, skip actual research
            results.append({
                "prospect_id": prospect.get("id"),
                "company_name": company_name,
                "success": True,
                "research_data": {},
                "updated_fields": ["quick_notes", "research_status"],
                "errors": []
            })
            successful += 1
        else:
            if not perplexity:
                logger.error("Perplexity client not initialized")
                failed += 1
                continue

            result = research_and_update_prospect(api, perplexity, prospect, dry_run)
            results.append(result)

            if result["success"]:
                successful += 1
                api_cost_estimate += 0.01  # ~$0.01 per research call
            else:
                failed += 1

    # Step 3: Summary
    logger.info(f"\n[3/3] Research Summary")
    logger.info(f"  Successful: {successful}/{len(prospects_to_research)}")
    logger.info(f"  Failed: {failed}/{len(prospects_to_research)}")

    if not dry_run and api_cost_estimate > 0:
        logger.info(f"  Estimated API cost: ${api_cost_estimate:.2f}")
        logger.info(f"  Monthly budget: $5.00")
        logger.info(f"  Remaining budget estimate: ${5.00 - api_cost_estimate:.2f}")

    # Log errors if any
    errors_log = []
    for result in results:
        if result["errors"]:
            errors_log.append({
                "company_name": result["company_name"],
                "errors": result["errors"],
                "research_data": result.get("research_data", {})
            })

    if errors_log:
        logger.warning(f"\n⚠ {len(errors_log)} prospects had errors:")
        for error_entry in errors_log[:5]:
            logger.warning(f"  - {error_entry['company_name']}: {', '.join(error_entry['errors'])}")
        if len(errors_log) > 5:
            logger.warning(f"  ... and {len(errors_log) - 5} more")

    # Final summary
    logger.info("\n" + "=" * 70)
    logger.info("RESEARCH COMPLETED")
    logger.info("=" * 70)
    logger.info(f"Prospects processed: {len(prospects_to_research)}")
    logger.info(f"Successfully researched: {successful}")
    logger.info(f"Failed: {failed}")
    logger.info(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit(main())
