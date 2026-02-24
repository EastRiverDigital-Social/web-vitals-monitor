const fs = require("fs");
const path = require("path");

const URLS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "urls.json"), "utf-8")
);
const RESULTS_DIR = path.join(__dirname, "..", "results");
const PSI_API_KEY = process.env.PSI_API_KEY || "";

// Ensure results directory exists
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const today = new Date().toISOString().split("T")[0];

async function fetchPageSpeedInsights(url, strategy = "mobile") {
  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  for (const cat of ["performance", "accessibility", "best-practices", "seo"]) {
    endpoint.searchParams.append("category", cat);
  }
  if (PSI_API_KEY) {
    endpoint.searchParams.set("key", PSI_API_KEY);
  }

  const res = await fetch(endpoint.toString());
  if (!res.ok) {
    throw new Error(`PSI API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function extractMetrics(psiData) {
  const { lighthouseResult, loadingExperience } = psiData;

  // Lab metrics from Lighthouse
  const audits = lighthouseResult?.audits || {};
  const lab = {
    lcp_ms: audits["largest-contentful-paint"]?.numericValue ?? null,
    fcp_ms: audits["first-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    tbt_ms: audits["total-blocking-time"]?.numericValue ?? null,
    si_ms: audits["speed-index"]?.numericValue ?? null,
    tti_ms: audits["interactive"]?.numericValue ?? null,
  };

  // Scores
  const categories = lighthouseResult?.categories || {};
  const scores = {
    performance: categories.performance?.score ?? null,
    accessibility: categories.accessibility?.score ?? null,
    best_practices: categories["best-practices"]?.score ?? null,
    seo: categories.seo?.score ?? null,
  };

  // Field data (CrUX) if available
  const crux = loadingExperience?.metrics || {};
  const field = {
    lcp_ms: crux.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    fid_ms: crux.FIRST_INPUT_DELAY_MS?.percentile ?? null,
    inp_ms: crux.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    cls: crux.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
      ? crux.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
      : null,
    fcp_ms: crux.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    ttfb_ms:
      crux.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ??
      crux.TIME_TO_FIRST_BYTE?.percentile ??
      null,
  };

  const hasFieldData = Object.values(field).some((v) => v !== null);

  return { lab, scores, field: hasFieldData ? field : null };
}

async function runLighthouseCLI(url) {
  // Dynamic import for lighthouse
  const { default: lighthouse } = await import("lighthouse");
  const chromeLauncher = await import("chrome-launcher");

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
  });

  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      onlyCategories: ["performance"],
    });

    const audits = result?.lhr?.audits || {};
    return {
      lcp_ms: audits["largest-contentful-paint"]?.numericValue ?? null,
      fcp_ms: audits["first-contentful-paint"]?.numericValue ?? null,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      tbt_ms: audits["total-blocking-time"]?.numericValue ?? null,
      si_ms: audits["speed-index"]?.numericValue ?? null,
      tti_ms: audits["interactive"]?.numericValue ?? null,
      performance_score: result?.lhr?.categories?.performance?.score ?? null,
    };
  } finally {
    await chrome.kill();
  }
}

async function crawlUrl(url) {
  console.log(`\n--- Crawling: ${url} ---`);
  const result = {
    url,
    date: today,
    timestamp: new Date().toISOString(),
    psi_mobile: null,
    psi_desktop: null,
    lighthouse_cli: null,
    errors: [],
  };

  // PageSpeed Insights - Mobile
  try {
    console.log("  [PSI] Fetching mobile results...");
    const mobileData = await fetchPageSpeedInsights(url, "mobile");
    result.psi_mobile = extractMetrics(mobileData);
    console.log(
      `  [PSI] Mobile performance: ${(result.psi_mobile.scores.performance * 100).toFixed(0)}`
    );
  } catch (err) {
    console.error(`  [PSI] Mobile error: ${err.message}`);
    result.errors.push({ source: "psi_mobile", message: err.message });
  }

  // PageSpeed Insights - Desktop
  try {
    console.log("  [PSI] Fetching desktop results...");
    const desktopData = await fetchPageSpeedInsights(url, "desktop");
    result.psi_desktop = extractMetrics(desktopData);
    console.log(
      `  [PSI] Desktop performance: ${(result.psi_desktop.scores.performance * 100).toFixed(0)}`
    );
  } catch (err) {
    console.error(`  [PSI] Desktop error: ${err.message}`);
    result.errors.push({ source: "psi_desktop", message: err.message });
  }

  // Lighthouse CLI fallback
  try {
    console.log("  [Lighthouse] Running local audit...");
    result.lighthouse_cli = await runLighthouseCLI(url);
    console.log(
      `  [Lighthouse] Performance: ${((result.lighthouse_cli.performance_score ?? 0) * 100).toFixed(0)}`
    );
  } catch (err) {
    console.error(`  [Lighthouse] Error: ${err.message}`);
    result.errors.push({ source: "lighthouse_cli", message: err.message });
  }

  return result;
}

async function main() {
  console.log(`=== Web Vitals Crawl: ${today} ===`);
  console.log(`URLs to crawl: ${URLS.length}`);

  const results = [];

  for (const url of URLS) {
    const result = await crawlUrl(url);
    results.push(result);
    // Small delay between requests to be respectful
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Save daily results
  const outFile = path.join(RESULTS_DIR, `${today}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outFile}`);

  return results;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
