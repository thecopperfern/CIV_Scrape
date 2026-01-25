"""
Geographic search utilities for finding prospects by ZIP code + radius

Uses free data sources:
- Google Maps (scraped public data)
- Yellow Pages (public listings)
- Yelp (public data)
- Free business directories

MVP approach: Simple web scraping + manual data sources
"""
import math
from typing import List, Dict, Optional
from utils.logger import setup_logger

logger = setup_logger(__name__)


class ZIPCodeDistance:
    """Calculate distances between ZIP codes"""

    # Approximate coordinates for common ZIP codes (lat, lon)
    # In production, would use a proper ZIP code database
    ZIP_COORDINATES = {
        "19505": (40.1972, -75.7622),  # Kutztown, PA area
        # Add more as needed
    }

    @staticmethod
    def lat_lon_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two coordinates in miles
        Using Haversine formula
        """
        R = 3959  # Earth's radius in miles

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c

        return distance

    @staticmethod
    def get_zip_coordinates(zipcode: str) -> Optional[tuple]:
        """Get approximate coordinates for ZIP code"""
        return ZIPCodeDistance.ZIP_COORDINATES.get(zipcode)


class GeographicProspectFinder:
    """Find business prospects within geographic radius"""

    # Sample business data for testing
    # In production, would integrate with real data sources
    SAMPLE_BUSINESSES = {
        "19505": [
            {
                "name": "Kutztown Dental Care",
                "category": "Dentist Office",
                "phone": "610-555-0101",
                "website": "kd-dental.com",
                "address": "123 Main St, Kutztown, PA 19530",
                "zipcode": "19530"
            },
            {
                "name": "Reading Medical Center",
                "category": "Medical/Healthcare Office",
                "phone": "610-555-0102",
                "website": None,
                "address": "456 Hospital Drive, Reading, PA 19601",
                "zipcode": "19601"
            },
            {
                "name": "Berks Construction",
                "category": "Construction/Contractor",
                "phone": "610-555-0103",
                "website": "berksconstruction.com",
                "address": "789 Industrial Blvd, Wyomissing, PA 19610",
                "zipcode": "19610"
            },
            {
                "name": "Exeter Corporate Office",
                "category": "Corporate Office",
                "phone": "610-555-0104",
                "website": "exeter-corp.com",
                "address": "321 Business Pk, Exeter Township, PA 19606",
                "zipcode": "19606"
            },
            {
                "name": "Maidencreek Dental",
                "category": "Dentist Office",
                "phone": "610-555-0105",
                "website": None,
                "address": "654 Route 422, Maidencreek, PA 19567",
                "zipcode": "19567"
            }
        ]
    }

    def __init__(self):
        logger.info("GeographicProspectFinder initialized")

    def search_by_radius(
        self,
        center_zipcode: str,
        radius_miles: float = 20,
        categories: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        Search for businesses within radius of ZIP code

        Args:
            center_zipcode: Center ZIP code (e.g., "19505")
            radius_miles: Search radius in miles (default 20)
            categories: Filter by business categories (optional)
            limit: Maximum results to return

        Returns:
            List of prospect businesses
        """
        logger.info(f"Searching within {radius_miles} miles of {center_zipcode}")

        if not categories:
            categories = [
                "Dentist Office",
                "Medical/Healthcare Office",
                "Construction/Contractor",
                "Corporate Office",
                "Manufacturing",
                "Retail"
            ]

        # Get center coordinates
        center_coords = ZIPCodeDistance.get_zip_coordinates(center_zipcode)
        if not center_coords:
            logger.warning(f"Unknown ZIP code: {center_zipcode}")
            # Return empty for unknown ZIPs (in production, would use ZIP database)
            return []

        results = []

        # Search through sample businesses
        # In production, would query real data sources here
        for zipcode_group, businesses in self.SAMPLE_BUSINESSES.items():
            for business in businesses:
                # Check if in radius (simplified for MVP)
                business_zip = business.get("zipcode", "")
                biz_coords = ZIPCodeDistance.get_zip_coordinates(business_zip)

                if not biz_coords:
                    # Assume roughly in radius if same area
                    if business_zip.startswith(center_zipcode[:3]):
                        distance = 5  # Approximate
                    else:
                        continue
                else:
                    distance = ZIPCodeDistance.lat_lon_distance(
                        center_coords[0], center_coords[1],
                        biz_coords[0], biz_coords[1]
                    )

                # Check if within radius
                if distance <= radius_miles:
                    # Check if category matches
                    if business.get("category") in categories:
                        business_copy = business.copy()
                        business_copy["distance_miles"] = round(distance, 1)
                        results.append(business_copy)

        # Sort by distance
        results.sort(key=lambda x: x.get("distance_miles", float('inf')))

        # Apply limit
        results = results[:limit]

        logger.info(f"✓ Found {len(results)} prospects within {radius_miles} miles")
        return results

    def search_by_category(
        self,
        center_zipcode: str,
        category: str,
        radius_miles: float = 20,
        limit: int = 50
    ) -> List[Dict]:
        """
        Search for specific business category within radius

        Args:
            center_zipcode: Center ZIP code
            category: Business category
            radius_miles: Search radius in miles
            limit: Maximum results

        Returns:
            List of matching prospects
        """
        return self.search_by_radius(
            center_zipcode=center_zipcode,
            radius_miles=radius_miles,
            categories=[category],
            limit=limit
        )

    def get_common_categories(self) -> List[str]:
        """Get list of searchable business categories"""
        return [
            "Dentist Office",
            "Medical/Healthcare Office",
            "Construction/Contractor",
            "Corporate Office",
            "Manufacturing",
            "Retail",
            "Restaurant/Hospitality",
            "Professional Services",
            "Legal Services",
            "Accounting/Finance",
            "Real Estate",
            "Education",
            "Gym/Fitness",
            "Salon/Spa",
            "Auto Services"
        ]
