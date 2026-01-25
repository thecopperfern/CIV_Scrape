"""
Web Scraping Fallback for Research
Provides free alternative when Perplexity API hits rate limits

Uses:
- Google Search (public data scraping)
- BeautifulSoup for HTML parsing
- Basic website analysis
"""
import re
from typing import Dict, Optional, List
try:
    from bs4 import BeautifulSoup
    HAS_BEAUTIFULSOUP = True
except ImportError:
    HAS_BEAUTIFULSOUP = False

from utils.logger import setup_logger

logger = setup_logger(__name__)


class WebScraperFallback:
    """
    Fallback web scraping for prospect research
    Used when Perplexity API unavailable or rate-limited
    """

    @staticmethod
    def extract_phone_from_html(html_content: str) -> Optional[str]:
        """
        Extract phone number from HTML content

        Args:
            html_content: HTML page content

        Returns:
            Phone number string or None
        """
        if not html_content:
            return None

        # Phone patterns
        patterns = [
            r'\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})',  # (123) 456-7890
            r'\+1[-.\s]?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})',  # +1-123-456-7890
            r'\b(\d{3})[.-](\d{3})[.-](\d{4})\b',  # 123.456.7890
        ]

        for pattern in patterns:
            match = re.search(pattern, html_content)
            if match:
                return match.group(0)

        return None

    @staticmethod
    def extract_email_from_html(html_content: str) -> List[str]:
        """
        Extract email addresses from HTML content

        Args:
            html_content: HTML page content

        Returns:
            List of email addresses
        """
        if not html_content:
            return []

        pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        matches = re.findall(pattern, html_content)

        # Filter out common non-contact emails
        filtered = [
            email for email in matches
            if not any(
                skip in email.lower()
                for skip in ['noreply', 'no-reply', 'robot', 'bot', 'admin@example']
            )
        ]

        return list(set(filtered))  # Remove duplicates

    @staticmethod
    def extract_social_links(html_content: str) -> Dict[str, str]:
        """
        Extract social media links from HTML

        Args:
            html_content: HTML page content

        Returns:
            Dictionary with social platform: URL mappings
        """
        if not html_content:
            return {}

        social_platforms = {
            'linkedin': r'(?:https?://)?(?:www\.)?linkedin\.com/(?:company|in)/[\w\-]+',
            'facebook': r'(?:https?://)?(?:www\.)?facebook\.com/[\w\-]+',
            'twitter': r'(?:https?://)?(?:www\.)?(?:twitter|x)\.com/[\w\-]+',
            'instagram': r'(?:https?://)?(?:www\.)?instagram\.com/[\w\-]+',
            'youtube': r'(?:https?://)?(?:www\.)?youtube\.com/(?:channel|c)/[\w\-]+',
        }

        found_links = {}
        for platform, pattern in social_platforms.items():
            match = re.search(pattern, html_content, re.IGNORECASE)
            if match:
                found_links[platform] = match.group(0)

        return found_links

    @staticmethod
    def extract_business_info_from_html(html_content: str) -> Dict[str, str]:
        """
        Extract basic business information from HTML

        Args:
            html_content: HTML page content

        Returns:
            Dictionary with extracted business info
        """
        if not html_content:
            return {}

        info = {}

        # Extract company description (meta description)
        meta_pattern = r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']\s*/>'
        meta_match = re.search(meta_pattern, html_content, re.IGNORECASE)
        if meta_match:
            info['meta_description'] = meta_match.group(1)[:200]

        # Extract heading text (usually company tagline/description)
        h1_pattern = r'<h1[^>]*>(.*?)</h1>'
        h1_match = re.search(h1_pattern, html_content, re.IGNORECASE)
        if h1_match:
            text = re.sub(r'<[^>]+>', '', h1_match.group(1)).strip()
            info['main_heading'] = text[:200]

        # Look for "About" section
        about_pattern = r'about\s+(?:us|company)["\']?\s*(?:is|:|)</?\s*([^<\n]{10,200})'
        about_match = re.search(about_pattern, html_content, re.IGNORECASE | re.DOTALL)
        if about_match:
            info['about_section'] = about_match.group(1)[:200]

        return info

    @staticmethod
    def parse_html_content(html_content: str) -> Dict:
        """
        Parse HTML content to extract contact and business info

        Args:
            html_content: Raw HTML content

        Returns:
            Dictionary with extracted data
        """
        if not HAS_BEAUTIFULSOUP:
            logger.warning("BeautifulSoup not installed. Install with: pip install beautifulsoup4")
            return WebScraperFallback._parse_html_regex(html_content)

        try:
            soup = BeautifulSoup(html_content, 'html.parser')

            # Remove script and style elements
            for script in soup(['script', 'style']):
                script.decompose()

            # Get text
            text = soup.get_text()

            # Basic extraction using regex on cleaned text
            result = {
                'phone': WebScraperFallback.extract_phone_from_html(text),
                'emails': WebScraperFallback.extract_email_from_html(text),
                'social_links': WebScraperFallback.extract_social_links(html_content),
                'business_info': WebScraperFallback.extract_business_info_from_html(html_content),
            }

            return result

        except Exception as e:
            logger.error(f"Error parsing HTML with BeautifulSoup: {e}")
            return WebScraperFallback._parse_html_regex(html_content)

    @staticmethod
    def _parse_html_regex(html_content: str) -> Dict:
        """Fallback regex-based HTML parsing (when BeautifulSoup unavailable)"""
        return {
            'phone': WebScraperFallback.extract_phone_from_html(html_content),
            'emails': WebScraperFallback.extract_email_from_html(html_content),
            'social_links': WebScraperFallback.extract_social_links(html_content),
            'business_info': WebScraperFallback.extract_business_info_from_html(html_content),
        }

    @staticmethod
    def analyze_contact_page(html_content: str) -> Dict[str, Optional[str]]:
        """
        Analyze a contact page specifically for contact information

        Args:
            html_content: HTML of contact page

        Returns:
            Dictionary with contact details
        """
        return {
            'phone': WebScraperFallback.extract_phone_from_html(html_content),
            'emails': WebScraperFallback.extract_email_from_html(html_content),
            'social_links': WebScraperFallback.extract_social_links(html_content),
        }


class GoogleSearchFallback:
    """
    Fallback using Google Search results for prospect research

    Note: This is a simple implementation that assumes search results are available.
    In production, would use dedicated search API or scraping.
    """

    @staticmethod
    def format_search_query(company_name: str, zipcode: str = "") -> str:
        """
        Format a search query for prospect research

        Args:
            company_name: Name of company to search
            zipcode: Zip code for geographic context

        Returns:
            Formatted search query
        """
        if zipcode:
            return f'"{company_name}" {zipcode} contact phone website'
        else:
            return f'"{company_name}" business contact phone website'

    @staticmethod
    def parse_search_results(search_results: List[str]) -> Dict:
        """
        Parse Google search results to extract contact info

        Args:
            search_results: List of search result snippets

        Returns:
            Dictionary with extracted information
        """
        info = {
            'phone': None,
            'website': None,
            'emails': [],
            'mentions': []
        }

        for result in search_results:
            # Extract phone number
            if not info['phone']:
                info['phone'] = WebScraperFallback.extract_phone_from_html(result)

            # Extract emails
            emails = WebScraperFallback.extract_email_from_html(result)
            info['emails'].extend(emails)

            # Extract website
            website_match = re.search(r'(?:https?://)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', result)
            if website_match and not info['website']:
                info['website'] = website_match.group(1)

            info['mentions'].append(result[:200])

        # Remove duplicate emails
        info['emails'] = list(set(info['emails']))

        return info


class LinkedInFallback:
    """
    Fallback for LinkedIn profile data
    Uses public LinkedIn profile information (if available)

    Note: LinkedIn terms of service restrict scraping.
    This is for reference only - actual use requires proper authorization.
    """

    @staticmethod
    def extract_company_info_from_profile(profile_html: str) -> Dict:
        """
        Extract company information from LinkedIn company profile

        Args:
            profile_html: HTML of LinkedIn company profile

        Returns:
            Dictionary with company information
        """
        info = {
            'employee_count': None,
            'industry': None,
            'description': None,
            'website': None,
            'headquarters': None,
            'founded': None,
        }

        # Employee count patterns
        emp_patterns = [
            r'(\d+(?:,\d{3})*)\s*(?:\+)?\s*employees?',
            r'company size["\']?\s*[:\-]?\s*(\d+(?:,\d{3})*)',
        ]

        for pattern in emp_patterns:
            match = re.search(pattern, profile_html, re.IGNORECASE)
            if match:
                try:
                    info['employee_count'] = int(match.group(1).replace(',', ''))
                    break
                except ValueError:
                    pass

        # Industry pattern
        industry_match = re.search(r'industry["\']?\s*[:\-]?\s*([^<\n]+)', profile_html, re.IGNORECASE)
        if industry_match:
            info['industry'] = industry_match.group(1).strip()[:100]

        # Website pattern
        website_match = re.search(r'(?:https?://)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', profile_html)
        if website_match:
            info['website'] = website_match.group(1)

        return info


class YelpFallback:
    """
    Fallback for Yelp business data
    Uses publicly available Yelp business information
    """

    @staticmethod
    def extract_business_data(yelp_html: str) -> Dict:
        """
        Extract business data from Yelp listing

        Args:
            yelp_html: HTML of Yelp business page

        Returns:
            Dictionary with business information
        """
        data = {
            'name': None,
            'rating': None,
            'review_count': None,
            'categories': [],
            'phone': None,
            'address': None,
            'website': None,
            'hours': None,
        }

        # Phone
        data['phone'] = WebScraperFallback.extract_phone_from_html(yelp_html)

        # Website
        website_match = re.search(r'website["\']?\s*[:\-]?\s*(?:https?://)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', yelp_html, re.IGNORECASE)
        if website_match:
            data['website'] = website_match.group(1)

        # Rating pattern (e.g., "4.5 stars")
        rating_match = re.search(r'(\d+\.?\d*)\s*(?:out of)?\s*5?\s*stars?', yelp_html, re.IGNORECASE)
        if rating_match:
            try:
                data['rating'] = float(rating_match.group(1))
            except ValueError:
                pass

        # Review count
        review_match = re.search(r'(\d+(?:,\d{3})*)\s*reviews?', yelp_html, re.IGNORECASE)
        if review_match:
            try:
                data['review_count'] = int(review_match.group(1).replace(',', ''))
            except ValueError:
                pass

        return data


def create_research_fallback_from_web(
    company_name: str,
    website_html: Optional[str] = None,
    contact_page_html: Optional[str] = None,
    search_results: Optional[List[str]] = None
) -> Dict:
    """
    Create research data from web sources as fallback

    Args:
        company_name: Name of company being researched
        website_html: HTML of company website homepage
        contact_page_html: HTML of contact page (if available)
        search_results: List of search result snippets

    Returns:
        Dictionary with researched company data
    """
    result = {
        'company_name': company_name,
        'success': False,
        'phone_number': None,
        'email': None,
        'website': None,
        'social_links': {},
        'business_info': {},
        'confidence': 0.0,
        'source': 'Web Scraping Fallback',
        'cost_estimate': 0.0  # Free
    }

    found_fields = 0
    total_fields = 4  # phone, email, website, industry

    # Parse website if provided
    if website_html:
        logger.debug(f"Analyzing website for {company_name}")
        website_data = WebScraperFallback.parse_html_content(website_html)

        if website_data.get('phone'):
            result['phone_number'] = website_data['phone']
            found_fields += 1

        if website_data.get('emails'):
            result['email'] = website_data['emails'][0]
            found_fields += 1

        if website_data.get('social_links'):
            result['social_links'] = website_data['social_links']

        if website_data.get('business_info'):
            result['business_info'] = website_data['business_info']

    # Parse contact page if provided
    if contact_page_html:
        logger.debug(f"Analyzing contact page for {company_name}")
        contact_data = WebScraperFallback.analyze_contact_page(contact_page_html)

        if contact_data.get('phone') and not result['phone_number']:
            result['phone_number'] = contact_data['phone']
            found_fields += 1

        if contact_data.get('emails') and not result['email']:
            result['email'] = contact_data['emails'][0]
            found_fields += 1

    # Parse search results if provided
    if search_results:
        logger.debug(f"Analyzing search results for {company_name}")
        search_data = GoogleSearchFallback.parse_search_results(search_results)

        if search_data.get('phone') and not result['phone_number']:
            result['phone_number'] = search_data['phone']
            found_fields += 1

        if search_data.get('website') and not result['website']:
            result['website'] = search_data['website']
            found_fields += 1

    # Calculate confidence
    result['confidence'] = min(1.0, found_fields / total_fields)
    result['success'] = result['confidence'] > 0.0

    logger.info(f"Web scraping research for {company_name}: confidence={result['confidence']:.0%}")

    return result
