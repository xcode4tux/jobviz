# JobViz

US Job Market Visualizer - Interactive treemap of BLS Occupational Outlook Handbook data.

Inspired by [karpathy.ai/jobs](https://karpathy.ai/jobs/).

## Features

- Visualizes 342 occupations covering 143M jobs
- Treemap with area = employment, color = selected metric
- Four color layers: BLS Outlook, Median Pay, Education, AI Exposure
- Interactive tooltips and statistics dashboard

## Setup

```bash
# Install dependencies
uv sync

# Install Playwright browser
uv run playwright install chromium

# Configure API key (for AI exposure scoring)
cp .env.example .env
# Edit .env with your API key
```

## Usage

See PLAN.md for detailed implementation steps.
