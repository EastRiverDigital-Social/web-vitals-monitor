const fs = require("fs");
const path = require("path");

const RESULTS_DIR = path.join(__dirname, "..", "results");
const REPORTS_DIR = path.join(__dirname, "..", "reports");

fs.mkdirSync(REPORTS_DIR, { recursive: true });

function loadAllResults() {
  const files = fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const allResults = {};
  for (const file of files) {
    const date = file.replace(".json", "");
    const data = JSON.parse(
      fs.readFileSync(path.join(RESULTS_DIR, file), "utf-8")
    );
    allResults[date] = data;
  }
  return allResults;
}

function scoreEmoji(score) {
  if (score === null || score === undefined) return "-";
  const pct = score * 100;
  if (pct >= 90) return `${pct.toFixed(0)} :green_circle:`;
  if (pct >= 50) return `${pct.toFixed(0)} :orange_circle:`;
  return `${pct.toFixed(0)} :red_circle:`;
}

function formatMs(val) {
  if (val === null || val === undefined) return "-";
  if (val < 1000) return `${val.toFixed(0)}ms`;
  return `${(val / 1000).toFixed(2)}s`;
}

function formatCLS(val) {
  if (val === null || val === undefined) return "-";
  return val.toFixed(3);
}

function clsRating(val) {
  if (val === null) return "-";
  if (val <= 0.1) return "Good";
  if (val <= 0.25) return "Needs Improvement";
  return "Poor";
}

function lcpRating(ms) {
  if (ms === null) return "-";
  if (ms <= 2500) return "Good";
  if (ms <= 4000) return "Needs Improvement";
  return "Poor";
}

function inpRating(ms) {
  if (ms === null) return "-";
  if (ms <= 200) return "Good";
  if (ms <= 500) return "Needs Improvement";
  return "Poor";
}

function generateDailyReport(date, results) {
  let md = `# Web Vitals Report - ${date}\n\n`;
  md += `> Generated at ${new Date().toISOString()}\n\n`;

  for (const entry of results) {
    const { url, psi_mobile, psi_desktop, lighthouse_cli, errors } = entry;
    md += `## ${url}\n\n`;

    // Scores overview
    if (psi_mobile || psi_desktop) {
      md += `### Scores\n\n`;
      md += `| Category | Mobile | Desktop |\n`;
      md += `|----------|--------|--------|\n`;
      const cats = ["performance", "accessibility", "best_practices", "seo"];
      const catLabels = {
        performance: "Performance",
        accessibility: "Accessibility",
        best_practices: "Best Practices",
        seo: "SEO",
      };
      for (const cat of cats) {
        const mScore = psi_mobile?.scores?.[cat] ?? null;
        const dScore = psi_desktop?.scores?.[cat] ?? null;
        md += `| ${catLabels[cat]} | ${scoreEmoji(mScore)} | ${scoreEmoji(dScore)} |\n`;
      }
      md += `\n`;
    }

    // Core Web Vitals - Lab (PSI)
    if (psi_mobile || psi_desktop) {
      md += `### Core Web Vitals (Lab - PSI)\n\n`;
      md += `| Metric | Mobile | Desktop |\n`;
      md += `|--------|--------|--------|\n`;
      md += `| LCP | ${formatMs(psi_mobile?.lab?.lcp_ms)} | ${formatMs(psi_desktop?.lab?.lcp_ms)} |\n`;
      md += `| FCP | ${formatMs(psi_mobile?.lab?.fcp_ms)} | ${formatMs(psi_desktop?.lab?.fcp_ms)} |\n`;
      md += `| CLS | ${formatCLS(psi_mobile?.lab?.cls)} | ${formatCLS(psi_desktop?.lab?.cls)} |\n`;
      md += `| TBT | ${formatMs(psi_mobile?.lab?.tbt_ms)} | ${formatMs(psi_desktop?.lab?.tbt_ms)} |\n`;
      md += `| Speed Index | ${formatMs(psi_mobile?.lab?.si_ms)} | ${formatMs(psi_desktop?.lab?.si_ms)} |\n`;
      md += `| TTI | ${formatMs(psi_mobile?.lab?.tti_ms)} | ${formatMs(psi_desktop?.lab?.tti_ms)} |\n`;
      md += `| **Page Load Time** | **${formatMs(psi_mobile?.lab?.page_load_ms)}** | **${formatMs(psi_desktop?.lab?.page_load_ms)}** |\n`;
      md += `| DOM Content Loaded | ${formatMs(psi_mobile?.lab?.dom_content_loaded_ms)} | ${formatMs(psi_desktop?.lab?.dom_content_loaded_ms)} |\n`;
      md += `\n`;
    }

    // Field data (CrUX) if available
    const mobileField = psi_mobile?.field;
    const desktopField = psi_desktop?.field;
    if (mobileField || desktopField) {
      md += `### Core Web Vitals (Field - CrUX)\n\n`;
      md += `| Metric | Mobile | Rating | Desktop | Rating |\n`;
      md += `|--------|--------|--------|---------|--------|\n`;
      md += `| LCP | ${formatMs(mobileField?.lcp_ms)} | ${lcpRating(mobileField?.lcp_ms)} | ${formatMs(desktopField?.lcp_ms)} | ${lcpRating(desktopField?.lcp_ms)} |\n`;
      md += `| INP | ${formatMs(mobileField?.inp_ms)} | ${inpRating(mobileField?.inp_ms)} | ${formatMs(desktopField?.inp_ms)} | ${inpRating(desktopField?.inp_ms)} |\n`;
      md += `| CLS | ${formatCLS(mobileField?.cls)} | ${clsRating(mobileField?.cls)} | ${formatCLS(desktopField?.cls)} | ${clsRating(desktopField?.cls)} |\n`;
      md += `| FCP | ${formatMs(mobileField?.fcp_ms)} | - | ${formatMs(desktopField?.fcp_ms)} | - |\n`;
      md += `| TTFB | ${formatMs(mobileField?.ttfb_ms)} | - | ${formatMs(desktopField?.ttfb_ms)} | - |\n`;
      md += `\n`;
    }

    // Lighthouse CLI results
    if (lighthouse_cli) {
      md += `### Lighthouse CLI (Local Audit)\n\n`;
      md += `| Metric | Value |\n`;
      md += `|--------|-------|\n`;
      md += `| Performance | ${scoreEmoji(lighthouse_cli.performance_score)} |\n`;
      md += `| LCP | ${formatMs(lighthouse_cli.lcp_ms)} |\n`;
      md += `| FCP | ${formatMs(lighthouse_cli.fcp_ms)} |\n`;
      md += `| CLS | ${formatCLS(lighthouse_cli.cls)} |\n`;
      md += `| TBT | ${formatMs(lighthouse_cli.tbt_ms)} |\n`;
      md += `| Speed Index | ${formatMs(lighthouse_cli.si_ms)} |\n`;
      md += `| TTI | ${formatMs(lighthouse_cli.tti_ms)} |\n`;
      md += `| **Page Load Time** | **${formatMs(lighthouse_cli.page_load_ms)}** |\n`;
      md += `| DOM Content Loaded | ${formatMs(lighthouse_cli.dom_content_loaded_ms)} |\n`;
      md += `\n`;
    }

    // Errors
    if (errors && errors.length > 0) {
      md += `### Errors\n\n`;
      for (const err of errors) {
        md += `- **${err.source}**: ${err.message}\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

function generateSummaryReadme(allResults) {
  const dates = Object.keys(allResults).sort().reverse();
  const latestDate = dates[0];
  const latestResults = allResults[latestDate];

  let md = `# Web Vitals Monitor\n\n`;
  md += `Automated daily Core Web Vitals tracking.\n\n`;
  md += `## Monitored URLs\n\n`;

  const urls = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "urls.json"), "utf-8")
  );
  for (const url of urls) {
    md += `- ${url}\n`;
  }

  md += `\n## Latest Results (${latestDate})\n\n`;
  md += `| URL | Perf (Mobile) | Perf (Desktop) | Page Load (Mobile) | Page Load (Desktop) | LCP (Mobile) | CLS (Mobile) |\n`;
  md += `|-----|--------------|----------------|-------------------|--------------------|--------------|--------------|\n`;

  for (const entry of latestResults) {
    const shortUrl = entry.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const mPerf = entry.psi_mobile?.scores?.performance;
    const dPerf = entry.psi_desktop?.scores?.performance;
    const mLoad = entry.psi_mobile?.lab?.page_load_ms;
    const dLoad = entry.psi_desktop?.lab?.page_load_ms;
    const mLcp = entry.psi_mobile?.lab?.lcp_ms;
    const mCls = entry.psi_mobile?.lab?.cls;
    md += `| ${shortUrl} | ${scoreEmoji(mPerf)} | ${scoreEmoji(dPerf)} | ${formatMs(mLoad)} | ${formatMs(dLoad)} | ${formatMs(mLcp)} | ${formatCLS(mCls)} |\n`;
  }

  md += `\n## Historical Reports\n\n`;
  for (const date of dates.slice(0, 30)) {
    md += `- [${date}](reports/${date}.md)\n`;
  }

  md += `\n## Trend (Last 7 Days - Mobile Performance)\n\n`;

  const recentDates = dates.slice(0, 7).reverse();
  if (recentDates.length > 1) {
    md += `| URL | ${recentDates.join(" | ")} |\n`;
    md += `|-----|${recentDates.map(() => "------").join("|")}|\n`;

    for (const url of urls) {
      const shortUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const row = [shortUrl];
      for (const date of recentDates) {
        const dayResults = allResults[date] || [];
        const entry = dayResults.find((r) => r.url === url);
        const score = entry?.psi_mobile?.scores?.performance;
        row.push(score !== null && score !== undefined ? `${(score * 100).toFixed(0)}` : "-");
      }
      md += `| ${row.join(" | ")} |\n`;
    }
  } else {
    md += `_Not enough data yet. Trends will appear after 2+ days of monitoring._\n`;
  }

  md += `\n---\n\n`;
  md += `_Last updated: ${new Date().toISOString()}_\n`;

  return md;
}

function main() {
  const allResults = loadAllResults();
  const dates = Object.keys(allResults).sort();

  if (dates.length === 0) {
    console.log("No results found. Run the crawl first.");
    process.exit(1);
  }

  // Generate daily report for each date
  for (const date of dates) {
    const reportFile = path.join(REPORTS_DIR, `${date}.md`);
    const report = generateDailyReport(date, allResults[date]);
    fs.writeFileSync(reportFile, report);
    console.log(`Generated report: ${reportFile}`);
  }

  // Generate summary README
  const readme = generateSummaryReadme(allResults);
  fs.writeFileSync(path.join(__dirname, "..", "README.md"), readme);
  console.log("Generated README.md");
}

main();
