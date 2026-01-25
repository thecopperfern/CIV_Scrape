# Quick Reference Guide

Fast lookup for common commands and troubleshooting.

---

## 🚀 Essential Commands

### System Validation (Start Here)
```bash
# Run all integration tests
python3 scripts/test_integration.py
```

### Sync Customers (Merge-Safe)
```bash
# Preview changes (no actual updates)
python3 scripts/sync_customers.py --dry-run

# Execute sync
python3 scripts/sync_customers.py

# Sync limited records
python3 scripts/sync_customers.py --limit 10

# Check conflicts
cat logs/sync_conflicts.log
```

### Find Prospects (Geographic)
```bash
# Preview (dry-run)
python3 scripts/find_prospects_geographic.py --dry-run

# Live import
python3 scripts/find_prospects_geographic.py

# Custom ZIP code and radius
python3 scripts/find_prospects_geographic.py \
  --zipcode 19505 \
  --radius 25 \
  --limit 50

# Specific categories
python3 scripts/find_prospects_geographic.py \
  --categories "Dentist Office,Medical/Healthcare Office"

# Export to CSV
python3 scripts/find_prospects_geographic.py \
  --output-csv prospects.csv \
  --dry-run
```

### Research Prospects (Perplexity API)
```bash
# Preview research (dry-run, no API calls)
python3 scripts/research_prospects.py --dry-run

# Live research
python3 scripts/research_prospects.py

# Limited research
python3 scripts/research_prospects.py --limit 20

# Research specific status
python3 scripts/research_prospects.py \
  --status "Not Started" \
  --limit 50

# Check API costs
grep -i "cost\|budget" logs/*.log
```

---

## 📋 Common Workflows

### Complete Fresh Start
```bash
# 1. Validate system
python3 scripts/test_integration.py

# 2. Sync existing customers (dry-run first)
python3 scripts/sync_customers.py --dry-run --limit 10
python3 scripts/sync_customers.py --limit 100

# 3. Find new prospects
python3 scripts/find_prospects_geographic.py --limit 50

# 4. Research (if Perplexity key set)
python3 scripts/research_prospects.py --limit 20
```

### Quick Daily Check
```bash
# Verify sync worked
python3 scripts/sync_customers.py --dry-run --limit 5

# Check for new prospects
python3 scripts/find_prospects_geographic.py --limit 10 --dry-run

# Monitor API usage
tail -20 logs/*.log
```

### Troubleshooting
```bash
# Check for import errors
python3 -c "import scripts.sync_customers; print('✓ OK')"

# View all logs
ls -lh logs/

# Watch logs in real-time
tail -f logs/*.log

# Check API connectivity
python3 scripts/test_integration.py 2>&1 | grep -i "connectivity"
```

---

## ⚙️ Configuration

### Set API Keys (.env)
```bash
# SmartSuite
SMARTSUITE_API_KEY=your_key_here
SMARTSUITE_ACCOUNT_ID=your_account_id

# Perplexity (optional)
PERPLEXITY_API_KEY=pk_your_key_here

# Tables
DESTINATION_INTELLIGENCE_HUB_TABLE_ID=6972e0912eaf730900141a54
```

### Environment Variables
```bash
# Dry run mode (no actual updates)
DRY_RUN=true

# Log level
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR

# Batch size
IMPORT_BATCH_SIZE=25
```

---

## 📊 Monitoring

### View Logs
```bash
# All logs
ls logs/

# Watch in real-time
tail -f logs/*.log

# Search for errors
grep -i error logs/*.log

# Check API costs
grep "cost\|budget\|api" logs/*.log
```

### Check Sync Conflicts
```bash
# View conflict report
cat logs/sync_conflicts.log

# Count conflicts
wc -l logs/sync_conflicts.log

# Find specific company
grep "Company Name" logs/sync_conflicts.log
```

### Monitor API Usage
```bash
# Perplexity API costs
grep "Estimated\|Monthly\|Remaining" logs/*.log

# Cost tracking
python3 -c "
import re
with open('logs/research_prospects.log') as f:
    content = f.read()
    costs = re.findall(r'Estimated.*cost: \$([0-9.]+)', content)
    total = sum(float(c) for c in costs)
    print(f'Total API cost: \${total:.2f}')
"
```

---

## 🔍 Troubleshooting

### "Module not found" Error
```bash
# Reinstall dependencies
pip install -r requirements.txt

# Verify imports
python3 -c "from utils.smartsuite_api import SmartSuiteAPI; print('OK')"
```

### "API connection failed"
```bash
# Check credentials
cat .env | grep SMARTSUITE

# Test connectivity
python3 scripts/test_integration.py
```

### "No records found"
```bash
# Check table IDs
grep TABLE_ID .env

# Verify account has data
python3 -c "
from config import Config
from utils.smartsuite_api import SmartSuiteAPI
api = SmartSuiteAPI()
records = api.get_all_records(Config.DESTINATION_INTELLIGENCE_HUB_TABLE_ID, batch_size=1)
print(f'Records found: {len(records)}')
"
```

### "Perplexity API returns 401"
```bash
# Verify API key
echo \$PERPLEXITY_API_KEY

# Check it's in .env
grep PERPLEXITY .env

# Test API connection
python3 -c "
import os
from utils.perplexity_client import PerplexityClient
key = os.getenv('PERPLEXITY_API_KEY')
if key:
    client = PerplexityClient(key)
    print('✓ API client initialized')
else:
    print('✗ API key not set')
"
```

### "Geographic search returns 0 results"
```bash
# Check sample data is loaded
python3 -c "
from utils.geographic_search import GeographicProspectFinder
finder = GeographicProspectFinder()
print(f'Sample data count: {len(finder.SAMPLE_BUSINESSES)}')
"

# Try different ZIP code
python3 scripts/find_prospects_geographic.py --zipcode 19505 --dry-run
```

---

## 📈 Performance Tips

### Speed Up Sync
```bash
# Use batch sync for large datasets
python3 scripts/sync_customers.py --limit 1000

# Check progress with tail
tail -f logs/*.log &
python3 scripts/sync_customers.py --limit 500
```

### Optimize Research
```bash
# Research in batches to track progress
for i in {1..5}; do
  python3 scripts/research_prospects.py --limit 20
done

# Monitor API costs
tail -f logs/*.log
```

### Parallel Execution (Not Recommended)
```bash
# Don't run multiple instances - can cause conflicts
# Instead, run sequentially:
python3 scripts/sync_customers.py --limit 50
python3 scripts/find_prospects_geographic.py --limit 50
python3 scripts/research_prospects.py --limit 50
```

---

## 🎯 Go/No-Go Checklist

### Before Production Launch
- [ ] `python3 scripts/test_integration.py` → 6/6 PASS
- [ ] `python3 scripts/sync_customers.py --dry-run --limit 5` → No data loss
- [ ] Manual review: 5 synced records intact
- [ ] `python3 scripts/find_prospects_geographic.py --dry-run` → Finds prospects
- [ ] Manual review: 5 new prospects have complete data
- [ ] `python3 scripts/research_prospects.py --dry-run --limit 5` → Successful
- [ ] API key configured (if using Perplexity)
- [ ] Logs reviewed: no critical errors
- [ ] Cost tracking: within budget

### If Any Check Fails
- [ ] Review logs for error details
- [ ] Run test_integration.py for diagnostics
- [ ] Check .env configuration
- [ ] Verify API connectivity
- [ ] Fix issue before proceeding

---

## 📞 Quick Help

### View Script Help
```bash
python3 scripts/sync_customers.py --help
python3 scripts/find_prospects_geographic.py --help
python3 scripts/research_prospects.py --help
```

### Common Errors & Solutions

| Error | Solution |
|-------|----------|
| `SMARTSUITE_API_KEY not set` | Add to `.env` file |
| `No records matched` | Check fuzzy matching threshold or sample data |
| `Perplexity API 401` | Verify `PERPLEXITY_API_KEY` in `.env` |
| `Module not found` | Run `pip install -r requirements.txt` |
| `Empty prospects found` | Geographic search uses sample data (5 businesses) |
| `Conflict detected` | Check `logs/sync_conflicts.log` for details |

---

## 📚 Documentation Map

| File | Purpose |
|------|---------|
| `SPRINT_PLAN_3DAYS.md` | Original sprint planning |
| `IMPLEMENTATION_STATUS.md` | Detailed status & checklist |
| `DAY4_VALIDATION.md` | Day 4 testing guide |
| `SPRINT_COMPLETE.md` | Final completion summary |
| `QUICK_REFERENCE.md` | This file (quick commands) |

---

## 🔗 File Structure

```
CIV_Scrape/
├── scripts/
│   ├── sync_customers.py ............ Customer sync with merge
│   ├── find_prospects_geographic.py . Geographic discovery
│   ├── research_prospects.py ........ Perplexity research
│   └── test_integration.py ......... Integration tests
├── utils/
│   ├── smartsuite_api.py ........... SmartSuite API wrapper
│   ├── field_mapping.py ............ Field transformation
│   ├── geographic_search.py ........ Geographic search
│   ├── perplexity_client.py ........ Perplexity API client
│   ├── web_scraper.py ............. Web scraping fallback
│   └── logger.py .................. Logging setup
├── logs/ .......................... Log files
├── config.py ...................... Configuration
├── .env ........................... API keys
└── README.md ...................... Project overview
```

---

## 💡 Pro Tips

1. **Always dry-run first**: Every script supports `--dry-run` to preview changes
2. **Monitor logs**: Keep `tail -f logs/*.log` running during testing
3. **Check conflicts**: Review `logs/sync_conflicts.log` after each sync
4. **Save costs**: Use `--dry-run` for research testing before live API calls
5. **Export data**: Use `--output-csv` to backup prospects before import
6. **Batch by status**: Filter by `research_status` to avoid re-researching
7. **Track budget**: Check estimated costs regularly against $5/month Perplexity budget

---

## 🚨 Emergency Recovery

### If Data Loss Detected
```bash
# 1. Stop all scripts
# 2. Check git history
git log --oneline

# 3. Review conflict log
cat logs/sync_conflicts.log

# 4. Manual restore from backups (if available)
# 5. Contact support for data recovery
```

### If API Fails
```bash
# 1. Check API status page
# 2. Verify credentials
cat .env

# 3. Retry with exponential backoff
for i in {1..3}; do
  python3 scripts/sync_customers.py --limit 10 && break
  sleep $((2 ** i))
done

# 4. Use web scraping fallback (free)
# Web scraper.py has no cost if Perplexity unavailable
```

---

## 📞 Support

For issues:
1. Check this QUICK_REFERENCE.md
2. Review DAY4_VALIDATION.md for detailed testing
3. Check logs with `tail -f logs/*.log`
4. Run `python3 scripts/test_integration.py`
5. Review error messages in logs

---

**Last Updated**: 2026-01-23
**Status**: ✅ Production Ready
