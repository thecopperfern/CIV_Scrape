CIV Enterprises — Customer Intelligence & Prospecting System

Version: 1.0

Last Updated: January 23, 2026

## Executive Summary

CIV Enterprises Customer Intelligence & Prospecting System automates importing, analyzing, and researching customers and prospects from the main CRM into a SmartSuite-based Customer Intelligence Hub. Phase 1 focuses on importing existing customers and classifying them to enable data-driven prospecting.

## Product Vision

- Analyze existing customer patterns to identify ideal client profiles
- Discover similar businesses in target geographies
- Automate prospect research (web, social, business signals)
- Manage outreach with personalized pitches

## Phases & Goals

- Phase 1 — Customer Import & Analysis (current)
	- Import all customers from the main CRM
	- Normalize contacts, calculate priority tiers, initial industry classification
	- Deliverables: Python import script, populated SmartSuite hub, contact quality report

- Phase 2 — Customer Pattern Analysis (next)
	- Identify top client patterns and generate Ideal Client Avatars

- Phase 3 — Automated Prospect Research (planned)
	- Scrape websites, discover social profiles, surface business signals

- Phase 4 — Geographic Prospect Discovery (planned)
	- Radius-based Google Maps discovery and campaign management

- Phase 5 — Outreach & Campaign Management (future)
	- Personalized pitch generation and campaign automation

## Success Metrics (high level)

- Phase 1: 100% of existing customers imported and classified
- Phase 2: 3–5 ideal client avatars defined
- Phase 3: 50+ qualified prospects generated/month
- Phase 5: 10%+ conversion on automated outreach

## Technical Overview

- Language: Python 3.8+
- Data store: SmartSuite (via REST API)
- Key libs: requests, python-dotenv, beautifulsoup4, lxml

Core scripts (examples)

- import_customers.py — One-time import from main CRM
- sync_customers.py — Regular sync
- analyze_customers.py — Pattern analysis & avatar creation
- research_business.py — Automated research
- find_prospects.py — Geographic discovery
- generate_outreach.py — Outreach & pitch generation

## SmartSuite Schema (high level)

- Customer Intelligence Hub — unified table for existing customers and prospects
- Ideal Client Avatar Profiles — 3–5 archetypes
- Research Task Queue — automated research jobs
- Search Campaigns — geographic search configs
- Outreach & Campaigns — campaign management and tracking

## Non-Functional Requirements

- API keys in environment variables; GitHub Secrets for CI/CD
- Rate limiting and batching for API calls
- Retry logic with exponential backoff
- Dry-run mode for safety and comprehensive logging

## Dependencies

- requests==2.31.0
- python-dotenv==1.0.0
- beautifulsoup4==4.12.0
- lxml==4.9.0

## Quick Start (local development)

1. Clone repository
	 ```bash
	 git clone <repo-url>
	 cd civ-customer-prospecting
	 ```
2. Create virtualenv and install
	 ```bash
	 python -m venv venv
	 source venv/bin/activate
	 pip install -r requirements.txt
	 cp .env.example .env
	 # Edit .env with SMARTSUITE credentials
	 ```
3. Dry-run import
	 ```bash
	 python scripts/import_customers.py --dry-run --limit 5
	 ```

## Deployment & Automation

- GitHub Actions: manual import, weekly sync, daily research jobs
- Logs written to logs/ and Actions artifacts

## Risks & Mitigations (summary)

- API rate limits: batch + delay
- Data quality: validation + manual review
- Scraping blocks: rotate user-agents + respect robots.txt

## Contact

Owner: Copper Fern (CIV Enterprises)

---

Document version: 1.0 — Last updated January 23, 2026