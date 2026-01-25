# Day 4: Integration Testing & Validation

This document provides step-by-step instructions to validate the complete MVP before going live.

---

## Pre-Validation Checklist

Before running tests, ensure:

- [ ] `.env` file is configured with:
  ```
  SMARTSUITE_API_KEY=your_key
  SMARTSUITE_ACCOUNT_ID=your_account_id
  DESTINATION_INTELLIGENCE_HUB_TABLE_ID=6972e0912eaf730900141a54
  ```
- [ ] Perplexity API key available (optional, for research testing)
- [ ] Internet connection available (needed for API calls)
- [ ] Python 3.8+ installed
- [ ] Dependencies installed: `pip install -r requirements.txt`

---

## Test Execution Plan

### Step 1: System Health Check

**Purpose**: Verify all modules load correctly and APIs are accessible

```bash
# Import all modules to check for syntax errors
python3 -c "
from utils.smartsuite_api import SmartSuiteAPI
from utils.field_mapping import transform_customer_record
from utils.perplexity_client import PerplexityClient
from utils.geographic_search import GeographicProspectFinder
from scripts.sync_customers import fuzzy_match_company
print('✓ All modules imported successfully')
"

# Run integration test suite
python3 scripts/test_integration.py
```

**Expected Results**:
- ✓ All 6 integration tests pass
- ✓ API connectivity confirmed
- ✓ Field mapping validated
- ✓ Geographic search working
- ✓ Merge logic verified

---

### Step 2: Merge Safety Test (CRITICAL)

**Purpose**: Verify sync doesn't overwrite manual edits

**Test Case 1: Dry-Run Sync**
```bash
python3 scripts/sync_customers.py --dry-run --limit 5
```

**Expected Output**:
```
[1/4] Fetching customers from main CRM...
✓ Retrieved X customers

[2/4] Fetching existing records from Intelligence Hub...
✓ Retrieved Y existing records

[3/4] Matching and merging records...
✓ Matched N records

[4/4] DRY RUN - Skipping actual updates
  Would update: N records
```

**Verification Checklist**:
- [ ] No data loss reported
- [ ] Conflict log created (if applicable)
- [ ] Manual fields marked as preserved

**Test Case 2: Manual Verification**

1. Pick 3 customers with manually edited data (industry, revenue, notes)
2. Run dry-run sync
3. Verify in logs:
   - [ ] Industry NOT updated (preserved)
   - [ ] Revenue NOT updated (preserved)
   - [ ] Notes NOT updated (preserved)
   - [ ] Order counts WERE updated (if source has higher)

**Test Case 3: Live Sync (Limited)**

Only after dry-run confirms zero data loss:

```bash
python3 scripts/sync_customers.py --limit 3
```

Then manually check Intelligence Hub:
- [ ] 3 records updated
- [ ] Manual edits still intact
- [ ] Sync timestamp updated

---

### Step 3: Geographic Discovery Test

**Purpose**: Verify prospect discovery and deduplication work

**Test Case 1: Geographic Search Basic**
```bash
python3 scripts/find_prospects_geographic.py --limit 10 --dry-run
```

**Expected Output**:
```
[1/3] Searching for prospects within 20 miles of 19505...
✓ Found X prospects

[2/3] Deduplicating against existing...
✓ Deduplicated Y duplicates
  Unique prospects: Z

[3/3] Processing Z new prospects...
✓ Transformed Z prospects

[DRY-RUN] Would import the following prospects:
  - Company A (Industry A)
  - Company B (Industry B)
  ...
```

**Verification**:
- [ ] Geographic search returns results
- [ ] Deduplication working
- [ ] No existing customers re-imported

**Test Case 2: Category Filtering**
```bash
python3 scripts/find_prospects_geographic.py \
  --categories "Dentist Office,Medical/Healthcare Office" \
  --limit 20 \
  --dry-run
```

**Verification**:
- [ ] Only dentist/medical offices returned
- [ ] Correct count of filtered results

**Test Case 3: CSV Export**
```bash
python3 scripts/find_prospects_geographic.py \
  --limit 10 \
  --output-csv prospects_export.csv \
  --dry-run
```

**Verification**:
- [ ] prospects_export.csv created
- [ ] Contains 10 rows (plus header)
- [ ] All fields populated

**Test Case 4: Live Import (Limited)**
```bash
python3 scripts/find_prospects_geographic.py --limit 5
```

Then check Intelligence Hub:
- [ ] 5 new prospects added
- [ ] record_type = "New Prospect"
- [ ] All fields populated
- [ ] Batch ID consistent

---

### Step 4: Research Quality Test

**Purpose**: Verify Perplexity research enriches data correctly

**Prerequisites**:
- Set `PERPLEXITY_API_KEY` in `.env` file
- Budget awareness: Each test call costs ~$0.01

**Test Case 1: Dry-Run Research (No API Cost)**
```bash
python3 scripts/research_prospects.py --dry-run --limit 5
```

**Expected Output**:
```
[1/3] Fetching prospects from Intelligence Hub...
✓ Retrieved X total prospects
  Y need research (status: 'Not Started')
  Limited to 5 for this run

[2/3] Researching 5 prospects...
  [DRY-RUN] Simulating research without API calls...

[3/3] Research Summary
  Successful: 5/5
  Failed: 0/5
```

**Test Case 2: Live Research (Small Sample)**

**⚠️ WARNING: This will cost ~$0.05**

```bash
python3 scripts/research_prospects.py --limit 5
```

Monitor output for:
- [ ] 5 prospects processed
- [ ] Research successful for each
- [ ] Data enriched (phone, email, industry)
- [ ] Confidence scores assigned (0-1)
- [ ] Cost tracked: ~$0.05 for 5 calls

Then check Intelligence Hub:
- [ ] research_status = "Completed"
- [ ] quick_notes populated with research data
- [ ] Phone numbers added (if not present)
- [ ] Email addresses enriched

**Test Case 3: Cost Verification**
```bash
# Check logs for cost tracking
grep -i "cost\|budget\|api" logs/*.log
```

**Expected**:
- [ ] Cost per call: ~$0.01
- [ ] Monthly budget: $5.00
- [ ] Remaining estimate shown

---

### Step 5: End-to-End Workflow Test

**Purpose**: Verify complete pipeline with all components

**Full Pipeline Test** (Estimated cost: $0.15 total)

```bash
# Step 1: Sync existing customers (no cost)
echo "=== STEP 1: Sync Customers ==="
python3 scripts/sync_customers.py --dry-run --limit 3

# Step 2: Find new prospects (no cost)
echo "=== STEP 2: Find Geographic Prospects ==="
python3 scripts/find_prospects_geographic.py --limit 10 --dry-run

# Step 3: Research prospects (costs ~$0.15 for 15 calls)
echo "=== STEP 3: Research Prospects ==="
python3 scripts/research_prospects.py --dry-run --limit 15
```

**Success Criteria**:
- [ ] Step 1 completes with no errors
- [ ] Step 2 finds 5+ prospects
- [ ] Step 3 successfully dry-runs research
- [ ] No data corruption detected
- [ ] Logs created and accessible

---

## Manual Review Checklist

After automated tests pass, perform these manual checks:

### Review 1: Synced Customer Records
1. Go to Intelligence Hub in SmartSuite
2. Filter to 3 recently synced customers
3. For each customer verify:
   - [ ] company_name populated
   - [ ] number_of_jobs matches main CRM
   - [ ] priority_tier calculated correctly
   - [ ] manual industry classification preserved (not "Other")
   - [ ] manual revenue preserved (if set)
   - [ ] outreach notes intact

### Review 2: Newly Imported Prospects
1. Filter Intelligence Hub to record_type = "New Prospect"
2. Select 5 newly imported prospects
3. For each prospect verify:
   - [ ] company_name populated
   - [ ] industry_business_type assigned
   - [ ] website_url populated (if found)
   - [ ] phone_number populated (if found)
   - [ ] research_status = "Not Started"
   - [ ] lead_status = "New Prospect"
   - [ ] discovery notes in quick_notes

### Review 3: Researched Prospects
1. Filter to records with research_status = "Completed"
2. Select 5 researched records
3. For each prospect verify:
   - [ ] quick_notes contains research data
   - [ ] Confidence score shown
   - [ ] Business signals identified
   - [ ] Employee count (if found)
   - [ ] Industry classification improved
   - [ ] No original data lost

### Review 4: Conflict Resolution
1. Check `logs/sync_conflicts.log`
2. For each conflict:
   - [ ] Note the company name
   - [ ] Understand the conflict type
   - [ ] Decide action (approve source data or keep existing)
   - [ ] Document decision

### Review 5: Data Quality Spot Check
1. Open 10 random records
2. Verify:
   - [ ] No null/empty company names
   - [ ] All have record_type set
   - [ ] All have lead_status set
   - [ ] Tracking fields exist (calls_made, calls_answered, etc.)
   - [ ] No duplicate company names (fuzzy check)

---

## Troubleshooting Guide

### Issue: "API connectivity test failed"
**Solution**:
- Check `.env` file has correct keys
- Verify SmartSuite API is accessible
- Check network connectivity

### Issue: "Sync shows no records matched"
**Solution**:
- Verify company names match (fuzzy matching threshold 0.8)
- Check both tables have data
- Run with `--limit 1` to test smallest case

### Issue: "Geographic search returns 0 prospects"
**Solution**:
- MVP uses sample data only (5 businesses)
- Add more to `SAMPLE_BUSINESSES` in geographic_search.py
- Production version needs integration with real data sources

### Issue: "Perplexity API returns 401 error"
**Solution**:
- Check PERPLEXITY_API_KEY is set correctly in `.env`
- Verify API key hasn't expired
- Ensure account has available credits

### Issue: "Research costs more than $0.01 per call"
**Solution**:
- Check model being used (should be pplx-7b-online)
- Review token count in raw response
- Consider reducing max_tokens if needed

---

## Sign-Off Checklist

After completing all tests:

### ✓ Automated Tests
- [ ] Integration tests: 6/6 passing
- [ ] Field mapping test: passing
- [ ] Merge logic test: passing
- [ ] Geographic search test: passing

### ✓ Manual Tests
- [ ] Sync test (dry-run): no data loss
- [ ] Sync test (limited live): 3 records updated correctly
- [ ] Geographic test: 5-20 prospects found
- [ ] Research test (dry-run): 5 prospects processable
- [ ] Research test (live, if API available): 5 prospects enriched

### ✓ Manual Review
- [ ] 5 synced customers reviewed: manual edits intact
- [ ] 5 new prospects reviewed: complete data
- [ ] 5 researched prospects reviewed: enriched with no loss
- [ ] Conflict log reviewed (if any)
- [ ] Data quality spot check: 10 records valid

### ✓ Documentation
- [ ] README updated with latest commands
- [ ] Error logs reviewed
- [ ] Sync conflicts log archived (if any)
- [ ] Day 4 results documented

### ✓ Go/No-Go Decision
- [ ] **GO**: All tests pass, manual review confirms quality
- [ ] **NO-GO**: Issues found, document and resolve before proceeding

---

## Next Steps (After Day 4 Sign-Off)

### Week 1 (Day 5-7)
- [ ] Scale to 50+ prospects
- [ ] Verify API budget tracking
- [ ] Prepare outreach lists
- [ ] Set up call tracking

### Week 2+
- [ ] Implement web scraping fallback
- [ ] Add email verification
- [ ] Create outreach campaigns
- [ ] Monitor conversion rates

---

## Command Cheat Sheet

```bash
# Quick validation
python3 scripts/test_integration.py

# Full dry-run workflow
python3 scripts/sync_customers.py --dry-run --limit 5
python3 scripts/find_prospects_geographic.py --limit 20 --dry-run
python3 scripts/research_prospects.py --dry-run --limit 5

# Production workflow
python3 scripts/sync_customers.py --limit 10
python3 scripts/find_prospects_geographic.py --limit 50
python3 scripts/research_prospects.py --limit 20

# Check logs
tail -f logs/*.log
```

---

**Status**: Ready for Day 4 execution
**Last Updated**: 2026-01-23
