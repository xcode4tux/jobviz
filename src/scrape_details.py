#!/usr/bin/env python3
"""
Scrape detail HTML pages for all occupations from BLS OOH.

This script uses Playwright to download raw HTML for each occupation page.
BLS blocks headless browsers, so we run with headless=False.

Files are saved to html/{slug}.html

Usage:
    python src/scrape_details.py

Output:
    html/*.html - Raw HTML files for each occupation
"""

import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright


async def scrape_page(page, url: str, output_path: Path) -> bool:
    """Scrape a single page and save to file."""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(500)  # Brief pause for dynamic content

        content = await page.content()
        output_path.write_text(content, encoding="utf-8")
        return True
    except Exception as e:
        print(f"    Error scraping {url}: {e}")
        return False


async def main():
    """Main entry point."""
    # Load occupations list
    occupations_file = Path("occupations.json")
    if not occupations_file.exists():
        print(f"Error: {occupations_file} not found. Run scrape_occupations.py first.")
        return

    with open(occupations_file) as f:
        occupations = json.load(f)

    print(f"Found {len(occupations)} occupations")
    print("Starting scraping with Playwright...")
    print("Note: BLS blocks headless browsers, using non-headless mode\n")

    # Create html directory
    html_dir = Path("html")
    html_dir.mkdir(exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,  # BLS blocks headless
            args=["--disable-blink-features=AutomationControlled"],
        )

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
        )

        page = await context.new_page()

        success_count = 0
        skip_count = 0
        error_count = 0

        for i, occ in enumerate(occupations, 1):
            slug = occ["slug"]
            output_path = html_dir / f"{slug}.html"

            # Skip if already exists
            if output_path.exists():
                print(f"[{i}/{len(occupations)}] Skipping {slug} (already exists)")
                skip_count += 1
                continue

            print(f"[{i}/{len(occupations)}] Scraping {slug}...")

            success = await scrape_page(page, occ["url"], output_path)

            if success:
                success_count += 1
            else:
                error_count += 1

            # Rate limiting - be polite to BLS
            await asyncio.sleep(0.5)

        await browser.close()

    print(f"\n=== Summary ===")
    print(f"Successfully scraped: {success_count}")
    print(f"Skipped (already exists): {skip_count}")
    print(f"Errors: {error_count}")
    print(f"Total files in html/: {len(list(html_dir.glob('*.html')))}")


if __name__ == "__main__":
    asyncio.run(main())
