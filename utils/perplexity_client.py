"""
Perplexity API client for business research
Provides affordable research (~$0.01 per query, up to $5/month budget)
"""
import json
import time
from typing import Dict, Optional, List
import requests
from utils.logger import setup_logger

logger = setup_logger(__name__)


class PerplexityClient:
    """
    Client for Perplexity AI API
    Handles business research queries with web search

    Pricing: ~$0.005 per search query (stay within $5/month budget)
    """

    def __init__(self, api_key: str):
        """
        Initialize Perplexity client

        Args:
            api_key: Perplexity API key from https://www.perplexity.ai/
        """
        self.api_key = api_key
        self.base_url = "https://api.perplexity.ai"
        self.model = "pplx-7b-online"  # Cheapest model with web search
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })

        logger.info("Perplexity client initialized")

    def research_company(
        self,
        company_name: str,
        zipcode: Optional[str] = None,
        search_type: str = "comprehensive"
    ) -> Dict:
        """
        Research a company using Perplexity API

        Args:
            company_name: Company name to research
            zipcode: ZIP code for geographic context
            search_type: Type of research
                - "business_info": Basic company info
                - "contact_enrichment": Phone, emails, contacts
                - "signals": Business signals (hiring, expansion)
                - "comprehensive": All of the above

        Returns:
            {
                "company_name": "...",
                "success": bool,
                "company_info": {...},
                "phone_number": "...",
                "email": "...",
                "employee_count": int,
                "industry": "...",
                "signals": [...],
                "website": "...",
                "address": "...",
                "confidence": 0.0-1.0,
                "research_time": float,
                "cost_estimate": float
            }
        """
        start_time = time.time()
        result = {
            "company_name": company_name,
            "success": False,
            "company_info": {},
            "phone_number": None,
            "email": None,
            "employee_count": None,
            "industry": None,
            "signals": [],
            "website": None,
            "address": None,
            "confidence": 0.0,
            "research_time": 0.0,
            "cost_estimate": 0.01  # Rough estimate
        }

        try:
            # Build query based on search type
            if search_type == "business_info":
                query = f"What is {company_name} in {zipcode or 'USA'}? Provide company description, size, what they do."
            elif search_type == "contact_enrichment":
                query = f"Find contact information for {company_name} in {zipcode or 'USA'}. Include phone number, email address, and contact names."
            elif search_type == "signals":
                query = f"Recent news about {company_name} in {zipcode or 'USA'}. Are they hiring? Expanding? Opening new locations? Financial news?"
            else:  # comprehensive
                query = f"Research {company_name} in {zipcode or 'USA'}. Provide: company description, employee count, phone number, website, industry, recent news about hiring or expansion, and any other business signals."

            logger.debug(f"Researching: {company_name} ({search_type})")
            logger.debug(f"Query: {query}")

            # Call Perplexity API
            response = self.session.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "user",
                            "content": query
                        }
                    ],
                    "max_tokens": 500,
                    "temperature": 0.1  # Low temp for factual results
                },
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            # Extract response
            if "choices" in data and len(data["choices"]) > 0:
                research_text = data["choices"][0]["message"]["content"]
                result["success"] = True
                result["raw_research"] = research_text

                # Parse results
                result.update(self._parse_research_response(research_text, company_name))

                # Estimate confidence based on what was found
                found_fields = sum([
                    result.get("phone_number") is not None,
                    result.get("email") is not None,
                    result.get("website") is not None,
                    result.get("industry") is not None,
                ])
                result["confidence"] = min(1.0, found_fields / 4.0)

                logger.info(f"✓ Researched: {company_name} (confidence: {result['confidence']:.1%})")

            else:
                logger.warning(f"Invalid Perplexity response structure: {data}")
                result["success"] = False

        except requests.exceptions.RequestException as e:
            logger.error(f"Perplexity API error: {e}")
            result["success"] = False
        except Exception as e:
            logger.error(f"Error researching {company_name}: {e}")
            result["success"] = False

        result["research_time"] = time.time() - start_time
        return result

    def _parse_research_response(self, text: str, company_name: str) -> Dict:
        """
        Parse research response to extract structured data

        Args:
            text: Raw response text from Perplexity
            company_name: Company name (for context)

        Returns:
            Dictionary with extracted fields
        """
        parsed = {
            "phone_number": None,
            "email": None,
            "employee_count": None,
            "industry": None,
            "signals": [],
            "website": None,
            "address": None,
        }

        text_lower = text.lower()

        # Extract phone number (basic pattern: XXX-XXX-XXXX or (XXX) XXX-XXXX)
        import re
        phone_patterns = [
            r'\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})',
            r'\+1\s?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})'
        ]
        for pattern in phone_patterns:
            match = re.search(pattern, text)
            if match:
                parsed["phone_number"] = match.group(0)
                break

        # Extract email
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        email_match = re.search(email_pattern, text)
        if email_match:
            parsed["email"] = email_match.group(0)

        # Extract website
        website_pattern = r'(?:https?://)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
        website_match = re.search(website_pattern, text)
        if website_match:
            parsed["website"] = website_match.group(1)

        # Extract employee count
        if "employee" in text_lower:
            emp_pattern = r'(\d{1,}(?:,\d{3})*)\s+employees?'
            emp_match = re.search(emp_pattern, text)
            if emp_match:
                try:
                    parsed["employee_count"] = int(emp_match.group(1).replace(",", ""))
                except ValueError:
                    pass

        # Extract industry/type (simple keyword matching)
        industry_keywords = {
            "dental": "Dentist Office",
            "dentist": "Dentist Office",
            "orthodont": "Dentist Office",
            "medical": "Medical/Healthcare Office",
            "clinic": "Medical/Healthcare Office",
            "hospital": "Medical/Healthcare Office",
            "healthcare": "Medical/Healthcare Office",
            "construction": "Construction/Contractor",
            "contractor": "Construction/Contractor",
            "builder": "Construction/Contractor",
            "corporate": "Corporate Office",
            "office": "Corporate Office",
            "manufacturing": "Manufacturing",
            "retail": "Retail",
            "restaurant": "Restaurant/Hospitality",
            "hotel": "Restaurant/Hospitality",
            "professional services": "Professional Services",
            "law firm": "Legal Services",
            "attorney": "Legal Services",
            "accounting": "Accounting/Finance",
            "real estate": "Real Estate",
            "education": "Education",
            "school": "Education",
            "gym": "Gym/Fitness",
            "fitness": "Gym/Fitness",
            "salon": "Salon/Spa",
            "auto": "Auto Services",
        }

        for keyword, industry in industry_keywords.items():
            if keyword in text_lower:
                parsed["industry"] = industry
                break

        # Extract business signals
        signal_keywords = {
            "hiring": "Actively hiring",
            "expand": "Expanding operations",
            "new location": "Opening new location",
            "relocat": "Relocating",
            "acquisition": "Recent acquisition",
            "founded": "Recently founded",
            "startup": "Startup company",
            "ipo": "Recent IPO",
            "partnership": "New partnerships",
            "remodel": "Renovating/Remodeling",
            "renovation": "Renovating/Remodeling",
        }

        for keyword, signal in signal_keywords.items():
            if keyword in text_lower and signal not in parsed["signals"]:
                parsed["signals"].append(signal)

        return parsed

    def batch_research(
        self,
        companies: List[Dict],
        delay: float = 1.0
    ) -> List[Dict]:
        """
        Research multiple companies with delay to avoid rate limiting

        Args:
            companies: List of company data dicts with 'name' and optional 'zipcode'
            delay: Delay between requests in seconds

        Returns:
            List of research results
        """
        results = []

        for i, company in enumerate(companies, 1):
            logger.info(f"[{i}/{len(companies)}] Researching {company.get('name', 'Unknown')}...")

            result = self.research_company(
                company_name=company.get("name"),
                zipcode=company.get("zipcode"),
                search_type="comprehensive"
            )

            results.append(result)

            # Delay between requests to avoid rate limiting
            if i < len(companies):
                time.sleep(delay)

        return results
