#!/usr/bin/env python3
"""
Download pre-scraped HTML files from karpathy/jobs repository.

This is a fallback for when scraping BLS directly is not feasible.
The karpathy/jobs repo has the HTML files in a separate archive.

Usage:
    python src/download_html.py
"""

import gzip
import json
from pathlib import Path
from urllib.request import urlretrieve


def main():
    """Download and extract HTML files."""
    print("Downloading HTML files from karpathy/jobs repository...")

    # The karpathy/jobs repo doesn't have HTML files in the main repo
    # They're generated during the scrape process
    # Instead, we'll use the parse_occupations_and_details.py which
    # can work directly with the occupations.json and parsed data

    print("Note: HTML files are ~40MB and not in the github repo.")
    print("We'll use the parsed data from the karpathy/jobs repo instead.")

    # Download the occupations.csv which has the parsed data
    csv_url = "https://raw.githubusercontent.com/karpathy/jobs/master/occupations.csv"
    csv_path = Path("occupations.csv")

    print(f"\nDownloading {csv_url}...")
    urlretrieve(csv_url, csv_path)
    print(f"Saved to {csv_path}")

    # Download scores.json
    scores_url = "https://raw.githubusercontent.com/karpathy/jobs/master/scores.json"
    scores_path = Path("scores.json")

    print(f"\nDownloading {scores_url}...")
    urlretrieve(scores_url, scores_path)
    print(f"Saved to {scores_path}")

    print("\nDownloaded data files:")
    print(f"  - occupations.csv ({csv_path.stat().st_size:,} bytes)")
    print(f"  - scores.json ({scores_path.stat().st_size:,} bytes)")

    # Verify the data
    with open(csv_path) as f:
        lines = f.readlines()
        print(f"\noccupations.csv has {len(lines)} lines (including header)")

    with open(scores_path) as f:
        scores = json.load(f)
        print(f"scores.json has {len(scores)} occupation scores")


if __name__ == "__main__":
    main()
