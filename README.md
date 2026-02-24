# Web Vitals Monitor

Automated daily Core Web Vitals tracking.

## Monitored URLs

- https://iq.bcitechstore.com/
- https://ps.bcitechstore.com/
- https://www.tracking.me/
- https://theeyesongroup.com/
- https://shakersa.com/
- https://jo.bcitechstore.com/

## How It Works

1. **GitHub Actions** runs a daily cron job at 6:00 AM UTC
2. Each URL is tested using:
   - **Google PageSpeed Insights API** (mobile + desktop) - provides lab data and real-user CrUX field data
   - **Lighthouse CLI** - provides local lab audit as a second data point
3. Raw results are saved as JSON in `results/`
4. Markdown reports are generated in `reports/`
5. The README is updated with the latest summary and 7-day trends

## Metrics Tracked

### Core Web Vitals
| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

### Additional Metrics
- FCP (First Contentful Paint)
- TBT (Total Blocking Time)
- Speed Index
- TTI (Time to Interactive)
- TTFB (Time to First Byte)

### Scores
- Performance, Accessibility, Best Practices, SEO (0-100)

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd web-vitals-monitor
npm install
```

### 2. (Optional) Add a PageSpeed Insights API key

A free API key removes rate limits. Get one at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and enable the PageSpeed Insights API.

**For local use:**
```bash
export PSI_API_KEY=your_key_here
```

**For GitHub Actions:**
Add `PSI_API_KEY` as a repository secret under Settings > Secrets and variables > Actions.

### 3. Run manually

```bash
npm run run
```

### 4. Enable GitHub Actions

Push to GitHub and the workflow will run daily. You can also trigger it manually from the Actions tab.

## Adding/Removing URLs

Edit `urls.json` to add or remove URLs from monitoring.

---

_Last updated: initial setup_
