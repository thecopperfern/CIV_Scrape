# CIV Enterprises - Customer Prospecting & Research Automation

Automated system for importing, analyzing, and researching customer prospects for CIV Enterprises promotional products business.

## Features

**Phase 1: Customer Import & Intelligence Hub** ✅ COMPLETE
- ✅ Import existing customers from main CRM
- ✅ Automatic priority tier calculation based on order history
- ✅ Contact information extraction and normalization
- ✅ Outreach tracking fields (calls, order dates, status)

**Phase 2: Customer Sync & Merge** ✅ COMPLETE
- ✅ Merge-safe sync with conflict detection
- ✅ Preserve manual edits (industry, revenue, notes)
- ✅ Intelligent merge rules (preserve/update/merge)
- ✅ Conflict logging for manual review
- ✅ Dry-run support for safe testing

**Phase 3: Geographic Prospect Discovery** ✅ COMPLETE
- ✅ ZIP code-based geographic search (radius configurable)
- ✅ Category filtering (15 business types)
- ✅ Fuzzy deduplication (prevents reimporting)
- ✅ Bulk import to Intelligence Hub
- ✅ CSV export for review

**Phase 4: AI-Powered Research** ✅ COMPLETE
- ✅ Perplexity API integration (~$0.01/query, $5/month budget)
- ✅ 4 search types (business info, contacts, signals, comprehensive)
- ✅ Data extraction (phone, email, website, industry, signals)
- ✅ Confidence scoring (0-1 scale)
- ✅ Batch processing with rate limiting
- ✅ Web scraping fallback (FREE when API unavailable)

**Phase 5: Outreach & Tracking** 🚧 READY FOR DEPLOYMENT
- ✅ Call tracking (attempts & answers)
- ✅ Conversion tracking (order dates)
- ✅ Campaign status tracking
- ✅ Detailed outreach notes
- 🚧 Campaign automation (coming Week 2+)

**Future Enhancements** 🔄 PLANNED
- 🚧 Email verification
- 🚧 Phone number validation
- 🚧 LinkedIn profile enrichment
- 🚧 Custom email campaigns
- 🚧 SMS integration
- 🚧 Advanced analytics & ROI tracking

## Setup

### Prerequisites
- Python 3.8+
- SmartSuite account with API access
- Git (for version control)
 - Node.js 18+ (for the web app)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd CIV_Scrape
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` and add your SmartSuite credentials:
```bash
SMARTSUITE_API_KEY=your_api_key_here
SMARTSUITE_ACCOUNT_ID=your_account_id_here
```

### Verify Setup

Test your configuration:
```bash
python -c "from config import Config; print('✓ Configuration valid')"
```

## Web App (React + Node)

The web console lets you run every script, view job history/output, and browse SmartSuite records.

### Install Node dependencies
```bash
npm install
```

### Run locally (two terminals)
```bash
# Terminal 1: API server
npm run dev:server

# Terminal 2: React UI
npm run dev:web
```

### Build + Run (production)
```bash
npm run build
npm start
```

### Required env vars (add to .env)
```env
ADMIN_PASSWORD=change_me
SESSION_SECRET=change_me_too
PYTHON_BIN=python3
PORT=3001
```

## Usage

### System Validation (Start Here)

**Test all systems and configurations:**
```bash
python3 scripts/test_integration.py
```

This validates:
- ✓ API connectivity
- ✓ Field mapping
- ✓ Geographic search
- ✓ Perplexity readiness
- ✓ Merge logic
- ✓ Data quality

### Sync Customers (Merge-Safe)

**Preview changes (dry-run):**
```bash
python3 scripts/sync_customers.py --dry-run
```

**Execute sync (limited for testing):**
```bash
python3 scripts/sync_customers.py --limit 10
```

**Full customer sync:**
```bash
python3 scripts/sync_customers.py
```

**Options:**
- `--dry-run` - Simulate without updating records
- `--limit N` - Sync only N records

### Find Geographic Prospects

**Preview prospect discovery:**
```bash
python3 scripts/find_prospects_geographic.py --dry-run
```

**Discover new prospects:**
```bash
python3 scripts/find_prospects_geographic.py --limit 50
```

**Custom search:**
```bash
python3 scripts/find_prospects_geographic.py \
  --zipcode 19505 \
  --radius 25 \
  --categories "Dentist Office,Medical/Healthcare Office"
```

**Export to CSV:**
```bash
python3 scripts/find_prospects_geographic.py \
  --output-csv prospects.csv \
  --dry-run
```

**Options:**
- `--zipcode` - Center ZIP code (default: 19505)
- `--radius` - Search radius in miles (default: 20)
- `--categories` - Comma-separated business categories
- `--limit` - Maximum prospects (default: 50)
- `--output-csv` - Export results to CSV
- `--dry-run` - Preview without importing

### Research Prospects (Perplexity API)

**Preview research (dry-run, no API cost):**
```bash
python3 scripts/research_prospects.py --dry-run
```

**Research prospects with API (costs ~$0.01/call):**
```bash
python3 scripts/research_prospects.py --limit 20
```

**Research specific status:**
```bash
python3 scripts/research_prospects.py \
  --status "Not Started" \
  --limit 50
```

**Options:**
- `--dry-run` - Simulate research without API calls
- `--limit N` - Research only N prospects
- `--status` - Filter by research status
  - "Not Started" (default)
  - "Completed"
  - Any custom status value

### Import Customers (Original Script)

**Dry run (recommended first time):**
```bash
python scripts/import_customers.py --dry-run
```

**Import first 10 customers (testing):**
```bash
python scripts/import_customers.py --limit 10
```

**Full import:**
```bash
python scripts/import_customers.py
```

**Options:**
- `--dry-run` - Simulate without creating records
- `--limit N` - Import only N records
- `--batch-size N` - Records per batch (default: 25)

## Project Structure

```
CIV_Scrape/
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── NEXT_STEPS_ANALYSIS.md # Roadmap and feature analysis
├── .env.example          # Environment template
├── .gitignore           # Git ignore rules
├── Makefile              # Convenient commands
├── pytest.ini            # Test configuration
├── run_tests.sh          # Test runner script
├── utils/
│   ├── smartsuite_api.py   # SmartSuite API wrapper
│   ├── field_mapping.py    # Data transformation logic
│   └── logger.py          # Logging configuration
├── scripts/
│   └── import_customers.py # Customer import script
├── tests/                 # Comprehensive test suite
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── conftest.py       # Test fixtures
└── logs/                  # Log files (auto-created)
```

## SmartSuite Schema

### Source: Customers Table

- **Table ID**: 65fa17c1c4bf7d283e83807a
- **Key Fields**: Company name, contacts, order count, customer type

### Destination: Customer Intelligence Hub

- **Table ID**: 6972e0912eaf730900141a54
- **Purpose**: Unified customer and prospect tracking with research data

## Troubleshooting

### API Authentication Errors

- Verify API key in `.env`
- Check Account ID is correct
- Ensure API access is enabled in SmartSuite

### Import Failures

- Check logs in `logs/` directory
- Run with `--dry-run` to test without creating records
- Use `--limit 1` to test single record

### Missing Dependencies

```bash
pip install -r requirements.txt --upgrade
```

## Testing

The project includes a comprehensive test suite with 75 tests covering all functionality.

### Running Tests

**Run all tests**:
```bash
make test
# or
./run_tests.sh
# or
python -m pytest
```

**Run specific test types**:
```bash
make test-unit              # Unit tests only (fast)
make test-integration       # Integration tests only
make test-fast              # Quick tests without coverage
make test-coverage          # Detailed coverage report
```

**Run individual test files**:
```bash
python -m pytest tests/unit/test_field_mapping.py -v
python -m pytest tests/unit/test_smartsuite_api.py -v
```

### Test Coverage

Current coverage: **80%+** across all modules

- **75 tests total**
  - 55 unit tests
  - 20 integration tests
- **Coverage by module**:
  - `utils/field_mapping.py`: 95%+
  - `utils/smartsuite_api.py`: 90%+
  - `config.py`: 85%+

View detailed coverage:
```bash
make test-coverage
open htmlcov/index.html  # View HTML report
```

### Test Structure

- **Unit Tests**: Fast, isolated tests of individual functions
- **Integration Tests**: Test full workflows with mocked APIs
- **Fixtures**: Reusable test data in `tests/conftest.py`

## Logging

Logs are stored in `logs/` directory with timestamps:

- **Console**: INFO level and above
- **File**: DEBUG level (detailed)

View recent logs:
```bash
tail -f logs/scripts_import_customers_*.log
```

## GitHub Actions

The project includes automated workflows:

### Manual Customer Import

1. Go to **Actions** tab in GitHub
2. Select **Import Customers (Manual)**
3. Click **Run workflow**
4. Configure options:
   - **Dry run**: Test without creating records
   - **Limit**: Number of records (0 = all)

### Setting Up Secrets

Add these secrets to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add new repository secrets:
   - `SMARTSUITE_API_KEY`: Your SmartSuite API key
   - `SMARTSUITE_ACCOUNT_ID`: Your SmartSuite account ID

## Data Transformation

### Priority Tier Calculation

Records are automatically categorized based on order history:

- **Tier 1 - High Value**: 5+ completed orders
- **Tier 2 - Medium Value**: 3-4 completed orders
- **Tier 3 - Lower Value**: 1-2 completed orders
- **Unrated**: 0 orders or missing data

### Contact Extraction

The system extracts primary contact information from the contacts sub-items:

- Full name
- Email address
- Phone number

### Industry Mapping

Initial industry classification based on customer type:

- Company customers → "Corporate Office"
- Wholesale → "Other" (requires manual classification)
- Individual → "Other"

**Note**: Industry classification will be enhanced with AI-based analysis in future updates.

## Next Steps

After successful import:

1. Review imported customers in SmartSuite
2. Manually classify industries for accuracy
3. Run customer analysis script (coming soon)
4. Begin prospect research automation (coming soon)

## Development Roadmap

### Phase 1 - Customer Import & Intelligence Hub ✅ COMPLETE
- ✅ Import existing customers from main CRM
- ✅ Calculate priority tiers
- ✅ Extract and normalize contact information
- ✅ Initial industry classification
- ✅ Add outreach tracking fields

### Phase 2 - Customer Sync & Merge ✅ COMPLETE
- ✅ Merge-safe sync with conflict detection
- ✅ Preserve manual edits
- ✅ Intelligent merge rules
- ✅ Conflict logging
- ✅ Dry-run support

### Phase 3 - Geographic Prospect Discovery ✅ COMPLETE
- ✅ ZIP code-based geographic search
- ✅ Category filtering (15 business types)
- ✅ Fuzzy deduplication
- ✅ Bulk import to Intelligence Hub
- ✅ CSV export

### Phase 4 - AI-Powered Research ✅ COMPLETE
- ✅ Perplexity API integration ($5/month)
- ✅ 4 search types
- ✅ Data extraction & parsing
- ✅ Confidence scoring
- ✅ Web scraping fallback (FREE)
- ✅ Batch processing

### Phase 5 - Ready for Deployment ✅ COMPLETE
- ✅ Integration test suite (6 tests)
- ✅ Day 4 validation guide
- ✅ Comprehensive documentation
- ✅ Cost tracking & monitoring
- ✅ Error handling & logging

### Phase 6 - Outreach & Campaign Management 🔄 NEXT (Week 2+)
- 🚧 Campaign automation
- 🚧 Email campaign templates
- 🚧 Call tracking integration
- 🚧 SMS messaging
- 🚧 Response tracking

### Phase 7 - Advanced Analytics & Optimization 🔄 FUTURE
- 🚧 ROI calculations
- 🚧 Conversion rate tracking
- 🚧 A/B testing framework
- 🚧 Custom dashboards
- 🚧 Machine learning optimization

## API Reference

### SmartSuite API

- **Base URL**: https://app.smartsuite.com/api/v1
- **Authentication**: Token-based (API Key + Account ID)
- **Rate Limits**: Handled with exponential backoff
- **Batch Size**: 25 records per bulk operation

### Key Endpoints Used

- `GET /applications/{table_id}/` - Get table schema
- `POST /applications/{table_id}/records/list/` - List records with filtering
- `POST /applications/{table_id}/records/` - Create records (bulk)

## Support

For issues or questions:

1. Check logs in `logs/` directory
2. Review [SmartSuite API documentation](https://help.smartsuite.com/en/collections/3600982-api)
3. Contact CIV Enterprises tech team

## License

Proprietary - CIV Enterprises

## Version History

- **2.0.0** (2026-01-23) - Complete MVP: sync, geographic discovery, AI research, integration tests (2,055 lines of code)
  - ✅ Merge-safe customer sync with conflict detection
  - ✅ Geographic prospect discovery (ZIP code radius)
  - ✅ Perplexity API research integration ($5/month)
  - ✅ Web scraping fallback (FREE)
  - ✅ Outreach tracking fields
  - ✅ Integration test suite (6 tests)
  - ✅ Comprehensive documentation (2,500+ lines)

- **1.1.0** (2026-01-23) - Added comprehensive test suite (75 tests), CI/CD pipeline, documentation

- **1.0.0** (2026-01-23) - Initial release with customer import functionality

---

**Built for CIV Enterprises** - Promotional Products, Signs & Custom Apparel
Website: www.civenterprises.com
