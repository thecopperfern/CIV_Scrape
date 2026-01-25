# 3-4 Day Sprint Plan: MVP Prospect Testing
## CIV Enterprises Customer Prospecting System

**Goal**: Get testing with actual leads by end of week
**Timeline**: Days 1-3 core development, Day 4 testing/refinement
**Budget**: $0-50/month (using Perplexity API up to $5/mo)
**Approach**: Merge-friendly sync, free research tools, web scraping

---

## Day 1: Data Model & Sync Infrastructure

### Task 1.1: Add Revenue Field to Schema
**What**: Update SmartSuite Customer Intelligence Hub table
**Impact**: Track revenue + order count for better prioritization

**Changes**:
- Add `annual_revenue` field (number)
- Update `transform_customer_record()` to include revenue (default to 0)
- Add CSV import capability for QuickBooks revenue data

**Files to Create/Modify**:
- `utils/field_mapping.py` - Add revenue to schema
- `scripts/import_revenue.py` - Import CSV from QuickBooks

---

### Task 1.2: Add Tracking Fields
**What**: Prepare to track outreach effectiveness

**New Fields**:
- `calls_made` (number) - track attempts
- `calls_answered` (number) - track connections
- `first_order_date` (date) - track conversion
- `second_order_date` (date) - track retention
- `outreach_status` (single select) - Not Started / In Progress / Contacted / Replied / Converted
- `notes_from_outreach` (SmartDoc) - detailed tracking

**Files to Create**:
- Update field_mapping to handle new fields

---

### Task 1.3: Create sync_customers.py with Merge Logic
**What**: Update existing records without overwriting manual edits

**Strategy**:
1. Detect existing customer by company name (fuzzy match)
2. Merge data:
   - **Auto-update**: order_count, number_of_jobs, completed_orders
   - **Preserve**: manually classified industry, revenue (don't overwrite), outreach notes
   - **Flag conflicts**: If source has different name or major data change
3. Create conflict log for manual review

**Merge Rules**:
```
IF (field = "industry_business_type" AND value = "Other")
  THEN update from source
ELSE
  PRESERVE existing value (don't overwrite)

IF (field = "order_count" AND source > existing)
  THEN update (customer more active now)
ELSE IF (field = "revenue")
  THEN NEVER overwrite (user manually entered or from QuickBooks)
  THEN FLAG if source has different revenue data

IF (field = "contact_name" OR "email")
  THEN merge, never remove existing
```

**Files to Create**:
- `scripts/sync_customers.py` - Main sync script
- `utils/deduplication.py` - Fuzzy matching + conflict detection
- `logs/sync_conflicts.log` - Conflict tracking

---

## Day 2: Research Automation (Perplexity API)

### Task 2.1: Perplexity API Integration
**What**: Use Perplexity API for quick business research (up to $5/mo)

**Why Perplexity**:
- Cheaper than other APIs
- Built-in web search
- Good for business research
- Low token usage

**Research Types**:
- Company background (size, type, what they do)
- Contact info supplementation
- Industry verification
- Business signals (new locations, expansion, hiring)

**Files to Create**:
- `utils/perplexity_client.py` - API wrapper
- `scripts/research_prospects.py` - Research worker

**Implementation**:
```python
# Example usage
from utils.perplexity_client import PerplexityClient

client = PerplexityClient(api_key="YOUR_KEY")

research = client.research_company(
    company_name="Acme Dental",
    zipcode="19505",
    search_type="comprehensive"  # business_info, contact_enrichment, signals
)

# Returns: {
#   "company_info": {...},
#   "phone_number": "555-1234",
#   "employee_count": 15,
#   "signals": ["new location", "hiring"],
#   "confidence": 0.85
# }
```

---

### Task 2.2: Web Scraping Fallback (Free)
**What**: Basic web scraping for when Perplexity hits API limits

**Tools**:
- BeautifulSoup (already dependencies-friendly)
- Google Search (no API, just web scraping)
- LinkedIn public profiles (basic info only)

**Files to Create**:
- `utils/web_scraper.py` - Basic scraping logic
- `utils/google_search.py` - Search results parser

---

## Day 3: Geographic Discovery & Prospect Import

### Task 3.1: Geographic Search by ZIP Code
**What**: Find prospects in target radius (19505, 20 miles default)

**Approach** (Free):
1. Use Google Maps reviews/business listings (scraped)
2. Use Yellow Pages (public data)
3. Use Yelp (has free data)
4. Custom business directories

**Implementation**:
```python
# Find dental offices within 20 miles of 19505
prospects = find_prospects_by_category(
    zipcode="19505",
    radius_miles=20,
    categories=["Dentist", "Medical Office", "Dental Office"],
    limit=50
)

# Returns prospects with:
# - name, address, zipcode
# - phone, website, category
# - basic info from listings
```

**Files to Create**:
- `scripts/find_prospects_geographic.py` - Main search script
- `utils/geographic_search.py` - Search logic

---

### Task 3.2: Bulk Research & Import
**What**: Queue prospects for research and import to Intelligence Hub

**Workflow**:
1. Geographic search finds 50-100 prospects
2. Deduplicate against existing customers
3. Queue for research via Perplexity
4. Import to Intelligence Hub as "New Prospect"
5. Flag for manual review

**Files to Create**:
- `scripts/import_prospects.py` - Bulk import
- Research queue management

---

## Day 4: Testing & Refinement

### Test 1: Sync with Merge
```bash
# Test sync without overwrites
python scripts/sync_customers.py --dry-run

# Review conflict log
cat logs/sync_conflicts.log

# Execute sync
python scripts/sync_customers.py
```

### Test 2: Research on Small Sample
```bash
# Research 5 prospects manually
python scripts/research_prospects.py --limit 5 --dry-run

# Review results
# Decide: Is Perplexity API quality good?
# Can we use it for all prospects?
```

### Test 3: Geographic Search
```bash
# Find prospects near 19505
python scripts/find_prospects_geographic.py \
  --zipcode 19505 \
  --radius 20 \
  --limit 20 \
  --dry-run

# Review results for quality
```

### Test 4: Full Pipeline
```bash
# 1. Import existing customers (Phase 1)
python scripts/import_customers.py --limit 10

# 2. Sync with updates
python scripts/sync_customers.py --dry-run

# 3. Find prospects
python scripts/find_prospects_geographic.py --limit 20 --dry-run

# 4. Research prospects
python scripts/research_prospects.py --limit 20 --dry-run

# 5. Import prospects
python scripts/import_prospects.py --limit 20 --dry-run
```

---

## File Priority Matrix

### Critical Path (Days 1-3)
- [ ] Task 1.1: Revenue field
- [ ] Task 1.2: Tracking fields
- [ ] Task 1.3: sync_customers.py + deduplication
- [ ] Task 2.1: Perplexity API wrapper
- [ ] Task 3.1: Geographic search
- [ ] Task 3.2: Prospect import

### Important (Day 4+)
- [ ] Task 2.2: Web scraping fallback
- [ ] Revenue import from CSV
- [ ] Conflict resolution UI/workflow
- [ ] Research quality scoring

### Nice to Have (Week 2+)
- [ ] Phone number validation
- [ ] Email verification
- [ ] Industry confidence scoring
- [ ] Advanced deduplication

---

## API Usage Plan

### Perplexity ($5/month budget)
**Rate**: ~$0.01 per research call (estimate)
**Monthly**: 500 research calls = $5

**Strategy**:
- Phase 1 (Week 1): 50 prospects researched
- Phase 2 (Week 2): 100 prospects researched
- Phase 3+: Scale as needed

**Free Fallback**: Web scraping when hitting rate limits

---

## Data Flow Diagram

```
Main CRM (SmartSuite)
        |
        v
import_customers.py (Phase 1) ✅
        |
        v
Customer Intelligence Hub
        |
        +---> sync_customers.py (Day 1)
        |     [Merge + Flag Conflicts]
        |
        +---> analyze_customer_patterns.py (Day 3+)
        |     [Pattern Analysis]
        |
        v
Prospect Sources (Day 2-3):
  - Geographic search (ZIP code radius)
  - Perplexity research (company info)
  - Web scraping (contact enrichment)
        |
        v
research_prospects.py (Day 2)
[Perplexity API - up to $5/mo]
        |
        v
Prospect Intelligence
[Auto-classified, researched, ready for outreach]
        |
        v
Outreach Tracking (Day 4+)
[Calls, responses, conversions]
        |
        v
SmartSuite Reports & Dashboards
[Track: calls made, answered, orders]
```

---

## Success Criteria for Day 4

✅ Sync without data loss
- Existing customers updated
- No manual edits overwritten
- Conflicts flagged for review

✅ 20 new prospects discovered
- Geographic search working
- Deduplication working
- Ready for outreach

✅ Research quality validated
- Perplexity results useful
- Confidence scoring working
- Manual review needed for low-confidence

✅ Test outreach ready
- 20 prospects with full data
- Contact info present
- Industry classified
- Quality check passed

---

## Week 1 Deliverables

**End of Day 3**:
- Sync script with merge logic
- Perplexity API integration
- Geographic search
- 20 test prospects ready

**Day 4 Testing**:
- Verify no data loss
- Quality check on research
- Manual review of conflicts
- Go/no-go for Week 2

**By End of Week**:
- 50-100 prospects imported
- Outreach strategy defined
- Ready to start campaigns

---

## Notes on Being "Frugal"

This approach costs ~$5/month for Perplexity API and uses everything else free:

**Free**:
- Geographic search (web scraping)
- Web scraping (BeautifulSoup)
- Google search (public data)
- SmartSuite (you already have)
- GitHub Actions (already have)
- Claude API (you already have budget for)

**Minimal Cost**:
- Perplexity API ($0-5/mo)
- Possible email service later ($15-20/mo)

**No Cost**:
- AI tools you already have (Claude, GitHub Copilot)
- Python libraries (open source)
- Time (you're committed)

**Total Cost**: ~$5-25/month for full automation
