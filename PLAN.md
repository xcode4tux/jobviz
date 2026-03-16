# JobViz - Action Plan
## US Job Market Visualizer (inspired by karpathy.ai/jobs)

---

## Executive Summary

Build an interactive treemap visualization of US job market data from the Bureau of Labor Statistics (BLS) Occupational Outlook Handbook. The app displays 342 occupations covering 143M jobs, with color-coded metrics for growth outlook, pay, education, and AI exposure.

**Estimated Time**: 20-30 hours
**Complexity**: Medium (web scraping + data processing + visualization)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA PIPELINE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│  │  SCRAPE  │ -> │  PARSE   │ -> │TABULATE  │ -> │  SCORE   │     │
│  │          │    │          │    │          │    │          │     │
│  │ Playwright│   │BeautifulSoup│  │ Python   │    │   LLM    │     │
│  │  BLS.gov │    │ -> Markdown │  │ -> CSV   │    │  Gemini  │     │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘     │
│                                                      │             │
│                                                      v             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    data.json                                 │  │
│  │  (Occupations + Stats + AI Scores)                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              v                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   FRONTEND                                    │  │
│  │  ┌────────────────┐    ┌────────────────┐                    │  │
│  │  │  index.html    │    │   Canvas       │                    │  │
│  │  │  (Vanilla JS)  │ <-> │  Treemap       │                    │  │
│  │  └────────────────┘    └────────────────┘                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Project Setup (1-2 hours)

### 1.1 Initialize Project Structure
```bash
mkdir jobviz && cd jobviz
mkdir -p {data,html,pages,site,src}
touch pyproject.toml .gitignore .env
```

### 1.2 Install Dependencies
```toml
[project]
name = "jobviz"
version = "0.1.0"
dependencies = [
    "playwright>=1.40.0",
    "beautifulsoup4>=4.12.0",
    "requests>=2.31.0",
    "pandas>=2.1.0",
    "openai>=1.0.0",  # or anthropic/gemini
    "python-dotenv>=1.0.0",
    "markdownify>=0.11.0",
]
```

```bash
uv sync
uv run playwright install chromium
```

### 1.3 Environment Variables
```env
OPENROUTER_API_KEY=your_key_here
# or ANTHROPIC_API_KEY for Claude
```

---

## Phase 2: Data Scraping (3-4 hours)

### 2.1 Discover Occupations (`src/scrape_occupations.py`)
**Goal**: Get list of 342 occupations from BLS

```python
# TODO: Implement
# - Fetch https://www.bls.gov/ooh/
# - Parse occupation groups and titles
# - Extract URLs and SOC codes
# - Save to occupations.json
```

**Output**: `occupations.json`
```json
[
  {
    "title": "Software Developers",
    "url": "https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm",
    "category": "Computer and Information Technology",
    "soc_code": "15-1132"
  },
  ...
]
```

### 2.2 Scrape Detail Pages (`src/scrape_details.py`)
**Goal**: Download raw HTML for all 342 pages

```python
# TODO: Implement
# - Use Playwright (non-headless - BLS blocks bots)
# - Rate limiting (respect BLS servers)
# - Save raw HTML to html/{slug}.html
# - Resume capability (skip existing)
```

**Key Considerations**:
- BLS blocks headless browsers
- Implement retry logic
- Progress tracking

---

## Phase 3: Data Parsing (2-3 hours)

### 3.1 Parse HTML to Markdown (`src/parse_html.py`)
**Goal**: Extract structured data from raw HTML

```python
# TODO: Implement
# - Parse HTML files with BeautifulSoup
# - Extract:
#   - Job description
#   - Work environment
#   - Education requirements
#   - Pay (median, 10th, 90th percentile)
#   - Job outlook (projected growth, numeric)
#   - Employment count
# - Convert to clean Markdown
# - Save to pages/{slug}.md
```

**Fields to Extract**:
| Field | Source | Format |
|-------|--------|--------|
| Title | `<h1>` | string |
| Description | "What They Do" | markdown |
| Pay | "Pay" section | numbers |
| Education | "How to Enter" | enum |
| Job Outlook | "Job Outlook" | % growth |
| Employment | "Quick Facts" | number |

### 3.2 Tabulate Data (`src/make_csv.py`)
**Goal**: Create structured CSV/JSON

```python
# TODO: Implement
# - Parse all Markdown files
# - Extract numeric fields
# - Generate occupations.csv
# - Generate occupations.json
```

---

## Phase 4: LLM Scoring (2-3 hours)

### 4.1 Design Scoring Prompt (`src/score.py`)
**Goal**: Score AI exposure for each occupation

```python
PROMPT = """
You are an expert labor market analyst. Score this occupation's exposure to AI transformation (0-10):

OCCUPATION: {title}
DESCRIPTION: {description}
TASKS: {tasks}

Scoring rubric:
- 0-2: Manual/physical work, minimal digital interaction
- 3-5: Some digital tools, but core work is human-centric
- 6-7: Significant digital workflow, AI can assist substantially
- 8-10: Primarily knowledge work, AI can transform most tasks

Return JSON: {{"score": N, "rationale": "..."}}
"""
```

### 4.2 Batch Processing
```python
# TODO: Implement
# - Load occupations.json
# - Send prompts to LLM (Claude/Gemini via OpenRouter)
# - Parse responses
# - Save to scores.json
# - Handle errors/retries
# - Resume capability
```

**Output**: `scores.json`
```json
{
  "software-developers": {
    "score": 9,
    "rationale": "Primarily involves writing code, which LLMs can increasingly do..."
  }
}
```

---

## Phase 5: Frontend Visualization (5-8 hours)

### 5.1 Build Site Data (`src/build_site_data.py`)
```python
# TODO: Merge occupations.csv + scores.json -> site/data.json
```

### 5.2 Treemap Component (`site/index.html`)

**HTML Structure**:
```html
<div id="app">
  <header>
    <h1>US Job Market Visualizer</h1>
    <p>342 occupations • 143M jobs</p>
  </header>

  <nav id="layers">
    <button data-layer="outlook">BLS Outlook</button>
    <button data-layer="pay">Median Pay</button>
    <button data-layer="education">Education</button>
    <button data-layer="ai-exposure">Digital AI Exposure</button>
  </nav>

  <div id="visualization">
    <canvas id="treemap"></canvas>
    <div id="tooltip"></div>
  </div>

  <aside id="stats">
    <!-- Total Jobs, Avg Outlook, etc. -->
  </aside>
</div>
```

**JavaScript Implementation**:
```javascript
// TODO: Implement
// - Load data.json
// - Treemap layout algorithm (squarified)
// - Canvas rendering
// - Color scales for each layer
// - Hover interactions
// - Click to open BLS page
// - Statistics calculations
```

**Color Scales**:
| Layer | Scale | Range |
|-------|-------|-------|
| Outlook | Red → Green | -20% to +30% |
| Pay | Yellow → Purple | $20K to $200K |
| Education | 5 discrete colors | None → Doctoral |
| AI Exposure | White → Red | 0 to 10 |

### 5.3 Styling (`site/styles.css`)
```css
/* TODO: Modern, minimal design
 - Responsive layout
 - Dark mode support
 - Smooth transitions
 - Accessible colors
 */
```

---

## Phase 6: Deployment (1 hour)

### 6.1 Static Hosting Options
- **GitHub Pages** (free, simple)
- **Vercel/Netlify** (free, CDN)
- **Cloudflare Pages** (free, global CDN)

### 6.2 CI/CD (Optional)
```yaml
# .github/workflows/update.yml
# - Run pipeline weekly
# - Update data.json
# - Deploy to production
```

---

## Implementation Priority

### MVP (Minimum Viable Product)
1. Scrape + parse BLS data
2. Basic treemap visualization
3. Outlook + Pay color layers
4. Static deployment

### Full Feature Set
1. AI Exposure scoring
2. All 4 color layers
3. Statistics dashboard
4. Hover tooltips
5. Responsive design
6. CI/CD automation

---

## Key Technical Decisions

### Scraping Strategy
| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Playwright | Bypass bot detection | Slow, resource-heavy | **USE** |
| requests | Fast | Likely blocked | Avoid |
| BLS API | Official rate limits | May not exist | Research |

### LLM Provider
| Option | Cost | Quality | Speed | Decision |
|--------|------|---------|-------|----------|
| Gemini Flash | Cheapest | Good | Fastest | **RECOMMENDED** |
| Claude Haiku | Low | Excellent | Fast | Alternative |
| GPT-4o-mini | Low | Good | Fast | Alternative |

### Visualization
| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| D3.js | Powerful | Heavy | **RECOMMENDED** |
| Raw Canvas | Lightweight | More code | Alternative |
| ECharts | Easy | Large bundle | Alternative |

---

## File Structure

```
jobviz/
├── .env                    # API keys
├── .gitignore
├── pyproject.toml          # Python dependencies
├── README.md
├── PLAN.md                 # This file
├── occupations.json        # Master occupation list
├── occupations.csv         # Structured stats
├── scores.json             # AI exposure scores
├── html/                   # Raw BLS HTML (40MB)
│   └── *.html
├── pages/                  # Clean Markdown
│   └── *.md
├── src/                    # Python scripts
│   ├── scrape_occupations.py
│   ├── scrape_details.py
│   ├── parse_html.py
│   ├── make_csv.py
│   ├── score.py
│   └── build_site_data.py
└── site/                   # Static website
    ├── data.json           # Merged data for frontend
    ├── index.html
    ├── styles.css
    └── app.js
```

---

## Testing Strategy

1. **Unit Tests**: Each Python script
2. **Integration Tests**: Full pipeline
3. **Visual Tests**: Screenshot comparisons
4. **Data Validation**: Check for missing fields

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| BLS blocks scraping | High | Use Playwright, rate limit |
| LLM API costs | Medium | Cache results, use cheapest model |
| Data format changes | Medium | Version control, flexible parsing |
| Treemap performance | Low | Canvas rendering (fast) |

---

## Next Steps

1. **Review this plan** - Confirm approach
2. **Set up project** - Initialize structure
3. **Start scraping** - Begin data collection
4. **Build MVP** - Get basic visualization working
5. **Iterate** - Add features incrementally

---

## References

- Original: https://karpathy.ai/jobs/
- Source: https://github.com/karpathy/jobs
- BLS OOH: https://www.bls.gov/ooh/
- Treemap Algorithm: Squarified (Bruls et al. 2000)
