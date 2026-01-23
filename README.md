# CIV Enterprises - Customer Prospecting & Research Automation

Automated system for importing, analyzing, and researching customer prospects for CIV Enterprises promotional products business.

## Features

- ✅ Import existing customers from main CRM
- ✅ Automatic priority tier calculation based on order history
- ✅ Contact information extraction and normalization
- 🚧 Customer pattern analysis (coming soon)
- 🚧 Automated prospect research (coming soon)
- 🚧 Social media scanning (coming soon)

## Setup

### Prerequisites
- Python 3.8+
- SmartSuite account with API access
- Git (for version control)

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

## Usage

### Import Customers

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

### Command Options
```bash
python scripts/import_customers.py --help

Options:
  --dry-run              Simulate import without creating records
  --limit N              Import only N records (for testing)
  --batch-size N         Records per batch (default: 25)
```

## Project Structure

```
CIV_Scrape/
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── .env.example          # Environment template
├── .gitignore           # Git ignore rules
├── utils/
│   ├── smartsuite_api.py   # SmartSuite API wrapper
│   ├── field_mapping.py    # Data transformation logic
│   └── logger.py          # Logging configuration
├── scripts/
│   └── import_customers.py # Customer import script
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

### Phase 1 - Customer Import (Current)
- ✅ Import existing customers from main CRM
- ✅ Calculate priority tiers
- ✅ Extract and normalize contact information
- ✅ Initial industry classification

### Phase 2 - Customer Pattern Analysis (Next)
- 🚧 Identify top customer patterns
- 🚧 Generate Ideal Client Avatar profiles
- 🚧 Industry and demographic analysis

### Phase 3 - Automated Prospect Research (Planned)
- 🚧 Web scraping for business information
- 🚧 Social media profile discovery
- 🚧 Business signals detection

### Phase 4 - Geographic Prospect Discovery (Planned)
- 🚧 Radius-based searches from ZIP codes
- 🚧 Google Maps integration
- 🚧 Search campaign management

### Phase 5 - Outreach & Campaign Management (Future)
- 🚧 Personalized pitch generation
- 🚧 Campaign automation
- 🚧 Response tracking

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

- **1.0.0** (2026-01-23) - Initial release with customer import functionality

---

**Built for CIV Enterprises** - Promotional Products, Signs & Custom Apparel
Website: www.civenterprises.com
