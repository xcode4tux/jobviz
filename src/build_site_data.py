#!/usr/bin/env python3
"""
Build site data by merging occupations data with AI exposure scores.

This script combines:
- occupations.json (basic info)
- occupations.csv (employment stats, pay, education, outlook)
- scores.json (AI exposure scores)

Output: site/data.json
"""

import csv
import json
from pathlib import Path


def parse_education_level(edu_string: str) -> int:
    """Convert education level to numeric code for color mapping."""
    edu_lower = edu_string.lower()

    if "doctoral" in edu_lower or "professional" in edu_lower:
        return 5
    elif "master's" in edu_lower:
        return 4
    elif "bachelor's" in edu_lower:
        return 3
    elif "associate" in edu_lower or "postsecondary" in edu_lower:
        return 2
    elif "high school" in edu_lower or "no formal" in edu_lower:
        return 1
    else:
        return 0


def load_occupations_csv(csv_path: Path) -> dict:
    """Load occupations.csv and return dict by slug."""
    occupations = {}

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            slug = row.get("slug", "")
            if slug:
                occupations[slug] = {
                    "title": row.get("title", ""),
                    "category": row.get("category", ""),
                    "employment_2022": safe_int(row.get("num_jobs_2024")),
                    "employment_2032": safe_int(row.get("projected_employment_2034")),
                    "employment_change_percent": safe_float(row.get("outlook_pct")),
                    "median_pay": safe_float(row.get("median_pay_annual")),
                    "education Typical": row.get("entry_education", ""),
                    "education_level": parse_education_level(row.get("entry_education", "")),
                }

    return occupations


def safe_int(value: str | None) -> int | None:
    """Safely convert string to int."""
    if not value or value == "":
        return None
    try:
        return int(float(value.replace(",", "")))
    except (ValueError, AttributeError):
        return None


def safe_float(value: str | None) -> float | None:
    """Safely convert string to float."""
    if not value or value == "":
        return None
    try:
        return float(value.replace("%", "").replace(",", "").replace("$", ""))
    except (ValueError, AttributeError):
        return None


def load_scores(scores_path: Path) -> dict:
    """Load scores.json and return dict by slug."""
    with open(scores_path) as f:
        scores_list = json.load(f)

    # Convert list to dict by slug
    return {item["slug"]: item for item in scores_list}


def load_occupations_json(json_path: Path) -> list:
    """Load occupations.json to get URL mappings."""
    with open(json_path) as f:
        return json.load(f)


def build_site_data():
    """Build site/data.json from all sources."""
    base_dir = Path(".")

    # Load all data sources
    print("Loading data sources...")

    occupations_json = load_occupations_json(base_dir / "occupations.json")
    occupations_csv = load_occupations_csv(base_dir / "occupations.csv")
    scores = load_scores(base_dir / "scores.json")

    # Create URL mapping from occupations.json
    url_map = {occ["slug"]: occ["url"] for occ in occupations_json}

    # Merge data
    site_data = {"occupations": [], "metadata": {}}

    total_employment = 0
    weighted_outlook = 0
    employment_weight = 0

    for slug, csv_data in occupations_csv.items():
        score_data = scores.get(slug, {})

        # Build merged occupation record
        occupation = {
            "slug": slug,
            "title": csv_data["title"],
            "category": csv_data["category"],
            "url": url_map.get(slug, ""),
            "employment": csv_data["employment_2022"] or 0,
            "employment_2032": csv_data["employment_2032"],
            "outlook": csv_data["employment_change_percent"] or 0,
            "median_pay": csv_data["median_pay"] or 0,
            "education": csv_data["education Typical"],
            "education_level": csv_data["education_level"],
            "ai_score": score_data.get("exposure", 0),
            "ai_rationale": score_data.get("rationale", ""),
        }

        site_data["occupations"].append(occupation)

        # Accumulate for aggregate stats
        emp = occupation["employment"]
        if emp > 0:
            total_employment += emp
            if occupation["outlook"]:
                weighted_outlook += occupation["outlook"] * emp
                employment_weight += emp

    # Calculate metadata
    site_data["metadata"] = {
        "total_occupations": len(site_data["occupations"]),
        "total_employment": total_employment,
        "average_outlook": round(weighted_outlook / employment_weight, 1) if employment_weight > 0 else 0,
        "source": "BLS Occupational Outlook Handbook",
        "generated_at": "2026-03-16",
    }

    # Calculate tier breakdowns for outlook
    declining = sum(1 for o in site_data["occupations"] if o["outlook"] < 0)
    slow = sum(1 for o in site_data["occupations"] if 0 <= o["outlook"] <= 3)
    average = sum(1 for o in site_data["occupations"] if 4 <= o["outlook"] <= 7)
    fast = sum(1 for o in site_data["occupations"] if 8 <= o["outlook"] <= 14)
    much_faster = sum(1 for o in site_data["occupations"] if o["outlook"] >= 15)

    site_data["metadata"]["outlook_tiers"] = {
        "declining": declining,
        "slow": slow,
        "average": average,
        "fast": fast,
        "much_faster": much_faster,
    }

    # Calculate employment by outlook tier
    decl_emp = sum(o["employment"] for o in site_data["occupations"] if o["outlook"] < 0)
    grow_emp = sum(o["employment"] for o in site_data["occupations"] if o["outlook"] > 0)

    site_data["metadata"]["declining_employment"] = decl_emp
    site_data["metadata"]["growing_employment"] = grow_emp

    # Write output
    site_dir = Path("site")
    site_dir.mkdir(exist_ok=True)

    output_path = site_dir / "data.json"
    with open(output_path, "w") as f:
        json.dump(site_data, f, indent=2)

    print(f"\nSite data built successfully!")
    print(f"  - Occupations: {site_data['metadata']['total_occupations']}")
    print(f"  - Total Employment: {site_data['metadata']['total_employment']:,}")
    print(f"  - Average Outlook: {site_data['metadata']['average_outlook']}%")
    print(f"  - Output: {output_path.absolute()}")


if __name__ == "__main__":
    build_site_data()
