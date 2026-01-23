"""
Field mapping and transformation logic
Converts data from main Customers table to Customer Intelligence Hub format
"""
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple, Any
from utils.logger import setup_logger

logger = setup_logger(__name__)

def create_batch_id() -> str:
    """Create import batch ID with timestamp"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")

def create_date_field(include_time: bool = False) -> Dict:
    """Create SmartSuite date object"""
    now = datetime.now(timezone.utc)
    return {
        "date": now.isoformat(),
        "include_time": include_time
    }

def create_smartdoc(text: str) -> Dict:
    """
    Create SmartDoc structure for long text fields

    Args:
        text: Plain text content

    Returns:
        SmartDoc object with data, html, and preview
    """
    if not text:
        return {
            "data": {"type": "doc", "content": []},
            "html": "",
            "preview": ""
        }

    return {
        "data": {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": text
                        }
                    ]
                }
            ]
        },
        "html": f"<p>{text}</p>",
        "preview": text[:200]  # First 200 chars
    }

def calculate_priority_tier(num_jobs: int) -> str:
    """
    Convert number of jobs to priority tier

    Args:
        num_jobs: Number of completed jobs/orders

    Returns:
        Priority tier string
    """
    if num_jobs >= 5:
        return "Tier 1 - High Value"
    elif num_jobs >= 3:
        return "Tier 2 - Medium Value"
    elif num_jobs >= 1:
        return "Tier 3 - Lower Value"
    else:
        return "Unrated"

def extract_primary_contact(contacts_field: Dict) -> Tuple[Optional[str], Optional[str], Optional[list]]:
    """
    Extract first contact from sub-items array

    Args:
        contacts_field: Contacts sub-items field with structure:
            {
                "count": int,
                "items": [
                    {
                        "sd4f0d01f0": {"sys_root": "Full Name"},
                        "s080dbe686": ["email@example.com"],
                        "s8e9b74ad0": [{"phone_number": "555-1234", ...}]
                    }
                ]
            }

    Returns:
        Tuple of (contact_name, email, phone_number_array)
    """
    if not contacts_field or contacts_field.get("count", 0) == 0:
        logger.debug("No contacts found in contacts field")
        return None, None, None

    first_contact = contacts_field["items"][0]

    # Extract name
    name_obj = first_contact.get("sd4f0d01f0", {})
    contact_name = name_obj.get("sys_root", "")

    # Extract email (first in array)
    emails = first_contact.get("s080dbe686", [])
    email = emails[0] if emails else None

    # Extract phone (first in array, format for SmartSuite)
    phones = first_contact.get("s8e9b74ad0", [])
    phone_number = None
    if phones:
        phone_obj = phones[0]
        phone_number = [{
            "phone_country": phone_obj.get("phone_country", "US"),
            "phone_number": phone_obj.get("phone_number", ""),
            "phone_extension": phone_obj.get("phone_extension", ""),
            "phone_type": phone_obj.get("phone_type", 1)
        }]

    logger.debug(f"Extracted contact: {contact_name}, {email}")
    return contact_name, email, phone_number

def map_industry(customer_type: str, retail_category: str = None) -> str:
    """
    Map from old customer type to new industry classification

    Args:
        customer_type: Old "Customer Type" field value
        retail_category: Old "Retail Category" field value

    Returns:
        Industry string matching new system's options

    Note:
        This is a simple default mapping. Will be enhanced with:
        - AI-based classification from company notes
        - Manual review and correction
        - Pattern recognition from website analysis
    """
    # Default mapping - needs enhancement
    if not customer_type:
        return "Other"

    # Simple keyword matching (will improve later)
    customer_type_lower = customer_type.lower()

    if "wholesale" in customer_type_lower:
        return "Other"  # Needs manual classification
    elif "company" in customer_type_lower:
        return "Corporate Office"  # Default, needs review
    elif "individual" in customer_type_lower:
        return "Other"
    else:
        return "Other"

def transform_customer_record(source_record: Dict, batch_id: str) -> Dict:
    """
    Transform a record from Customers table to Customer Intelligence Hub format

    Args:
        source_record: Record from main Customers table
        batch_id: Import batch identifier

    Returns:
        Transformed record ready for insertion
    """
    logger.debug(f"Transforming record: {source_record.get('title', 'UNKNOWN')}")

    # Extract basic fields
    company_name = source_record.get("title", "")
    customer_type = source_record.get("sf17aef823", "")
    retail_category = source_record.get("sf910a12e2", "")
    website_links = source_record.get("s0542830c2", [])
    company_notes = source_record.get("s889d079ed", "")
    followup_emails = source_record.get("sdaea1a4ce", [])

    # Extract and parse number of jobs
    num_jobs_str = source_record.get("s4b7a3f28a", "0")
    try:
        num_jobs = int(num_jobs_str) if num_jobs_str else 0
    except (ValueError, TypeError):
        logger.warning(f"Could not parse num_jobs: {num_jobs_str}")
        num_jobs = 0

    # Extract contact info
    contacts = source_record.get("sffaeae042", {})
    contact_name, email, phone_number = extract_primary_contact(contacts)

    # Map industry
    industry = map_industry(customer_type, retail_category)

    # Calculate priority tier
    priority_tier = calculate_priority_tier(num_jobs)

    # Build transformed record
    transformed = {
        "record_type": "Existing Customer",
        "import_batch_id": batch_id,
        "last_synced_from_main_system": create_date_field(include_time=False),
        "company_name": company_name,
        "contact_name": contact_name or "",
        "email": [email] if email else [],
        "phone_number": phone_number or [],
        "industry_business_type": industry,
        "number_of_jobs": str(num_jobs),
        "priority_tier": priority_tier,
        "website_url": website_links[0] if website_links else "",
        "lead_status": "Existing Customer",
        "lead_source": "Main CRM Import",
        "research_status": "Not Started",
        "date_added": create_date_field(include_time=False)
    }

    # Add optional fields if present
    if company_notes:
        transformed["quick_notes"] = create_smartdoc(company_notes)

    # Add followup emails if different from primary
    if followup_emails and (not email or followup_emails[0] != email):
        # Merge with existing email
        all_emails = list(set([email] + followup_emails if email else followup_emails))
        transformed["email"] = all_emails

    logger.debug(f"Transformed to: {transformed.get('company_name')} (Tier: {priority_tier})")
    return transformed

def batch_transform_records(source_records: list, batch_id: str) -> list:
    """
    Transform multiple records

    Args:
        source_records: List of source records
        batch_id: Import batch identifier

    Returns:
        List of transformed records
    """
    logger.info(f"Transforming {len(source_records)} records")

    transformed = []
    errors = []

    for i, record in enumerate(source_records, 1):
        try:
            transformed_record = transform_customer_record(record, batch_id)
            transformed.append(transformed_record)
        except Exception as e:
            company_name = record.get("title", "UNKNOWN")
            logger.error(f"Error transforming record {i} ({company_name}): {e}")
            errors.append((i, company_name, str(e)))

    logger.info(f"Successfully transformed {len(transformed)}/{len(source_records)} records")
    if errors:
        logger.warning(f"Failed to transform {len(errors)} records")
        for idx, name, error in errors:
            logger.warning(f"  - Record {idx} ({name}): {error}")

    return transformed
