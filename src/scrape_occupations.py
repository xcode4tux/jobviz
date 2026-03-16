#!/usr/bin/env python3
"""
Scrape the list of occupations from BLS Occupational Outlook Handbook.

This script uses Playwright to fetch pages (BLS blocks simple HTTP requests)
and extracts all occupation titles, URLs, categories, and SOC codes.

Output: occupations.json
"""

import asyncio
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


# BLS OOH base URL
BASE_URL = "https://www.bls.gov/ooh/"

# Occupation groups and their URL patterns
GROUPS = {
    "Architecture and Engineering": "https://www.bls.gov/ooh/architecture-and-engineering/home.htm",
    "Arts and Design": "https://www.bls.gov/ooh/arts-and-design/home.htm",
    "Building and Grounds Cleaning": "https://www.bls.gov/ooh/building-and-grounds-cleaning/home.htm",
    "Business and Financial": "https://www.bls.gov/ooh/business-and-financial/home.htm",
    "Community and Social Service": "https://www.bls.gov/ooh/community-and-social-service/home.htm",
    "Computer and Information Technology": "https://www.bls.gov/ooh/computer-and-information-technology/home.htm",
    "Construction": "https://www.bls.gov/ooh/construction/home.htm",
    "Education, Training, and Library": "https://www.bls.gov/ooh/education-training-and-library/home.htm",
    "Entertainment and Sports": "https://www.bls.gov/ooh/entertainment-and-sports/home.htm",
    "Farming, Fishing, and Forestry": "https://www.bls.gov/ooh/farming-fishing-and-forestry/home.htm",
    "Food and Beverage": "https://www.bls.gov/ooh/food-and-beverage/home.htm",
    "Healthcare": "https://www.bls.gov/ooh/healthcare/home.htm",
    "Installation, Maintenance, and Repair": "https://www.bls.gov/ooh/installation-maintenance-and-repair/home.htm",
    "Legal": "https://www.bls.gov/ooh/legal/home.htm",
    "Management": "https://www.bls.gov/ooh/management/home.htm",
    "Math": "https://www.bls.gov/ooh/math/home.htm",
    "Media and Communication": "https://www.bls.gov/ooh/media-and-communication/home.htm",
    "Military": "https://www.bls.gov/ooh/military/home.htm",
    "Office and Administrative Support": "https://www.bls.gov/ooh/office-and-administrative-support/home.htm",
    "Personal Care and Service": "https://www.bls.gov/ooh/personal-care-and-service/home.htm",
    "Production": "https://www.bls.gov/ooh/production/home.htm",
    "Protective Service": "https://www.bls.gov/ooh/protective-service/home.htm",
    "Sales": "https://www.bls.gov/ooh/sales/home.htm",
    "Science": "https://www.bls.gov/ooh/science/home.htm",
    "Transportation and Material Moving": "https://www.bls.gov/ooh/transportation-and-material-moving/home.htm",
}


async def scrape_group_occupations(page, group_name: str, group_url: str) -> list[dict]:
    """Scrape occupations from a single group page."""
    occupations = []

    print(f"Scraping {group_name}...")

    try:
        await page.goto(group_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(1000)  # Wait a bit for dynamic content

        content = await page.content()
        soup = BeautifulSoup(content, "lxml")

        # Find all occupation links
        # BLS OOH uses specific HTML structure
        for link in soup.find_all("a", href=True):
            href = link["href"]

            # Look for occupation detail pages
            # They typically have URLs like ../occupation-name.htm
            if href.startswith("../") and href.endswith(".htm") and not href.endswith("home.htm"):
                # Extract the occupation page name
                match = re.search(r"\.\./([^/]+)\.htm", href)
                if match:
                    occ_slug = match.group(1)
                    title = link.get_text(strip=True)

                    # Skip if title is empty or too short
                    if len(title) < 3:
                        continue

                    # Skip if it's a group page (ends with "home")
                    if "home" in occ_slug:
                        continue

                    # Skip common non-occupation links
                    skip_patterns = ["print", "tab", "index", "sitemap"]
                    if any(pattern in occ_slug for pattern in skip_patterns):
                        continue

                    # Build full URL
                    full_url = f"https://www.bls.gov/ooh/{occ_slug}.htm"

                    occupations.append(
                        {
                            "title": title,
                            "slug": occ_slug,
                            "url": full_url,
                            "category": group_name,
                            "soc_code": None,  # Will be extracted later
                        }
                    )

    except Exception as e:
        print(f"  Error scraping {group_name}: {e}")

    return occupations


async def main():
    """Main entry point."""
    output_file = Path("occupations.json")

    all_occupations = []

    print("Scraping BLS Occupational Outlook Handbook...")
    print(f"Found {len(GROUPS)} occupation groups\n")

    async with async_playwright() as pw:
        # Launch browser (non-headless to avoid bot detection)
        browser = await pw.chromium.launch(
            headless=False,  # BLS blocks headless browsers
            args=["--disable-blink-features=AutomationControlled"],
        )

        # Create a new browser context with realistic user agent
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
        )

        page = await context.new_page()

        for group_name, group_url in GROUPS.items():
            occupations = await scrape_group_occupations(page, group_name, group_url)
            all_occupations.extend(occupations)
            print(f"  Found {len(occupations)} occupations\n")

        await browser.close()

    # Remove duplicates based on URL
    seen_urls = set()
    unique_occupations = []
    for occ in all_occupations:
        if occ["url"] not in seen_urls:
            seen_urls.add(occ["url"])
            unique_occupations.append(occ)

    # Sort by title
    unique_occupations.sort(key=lambda x: x["title"])

    # Save to JSON
    with open(output_file, "w") as f:
        json.dump(unique_occupations, f, indent=2)

    print(f"\nTotal occupations found: {len(unique_occupations)}")
    print(f"Saved to: {output_file.absolute()}")

    # Show sample
    print("\nSample occupations:")
    for occ in unique_occupations[:5]:
        print(f"  - {occ['title']} ({occ['category']})")


if __name__ == "__main__":
    asyncio.run(main())
