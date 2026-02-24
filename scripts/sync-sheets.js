const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const RESULTS_DIR = path.join(__dirname, "..", "results");
const SPREADSHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  "1_sh77zGRBCe7C5_5q6QpoJOef1evFu_jAgbUpqreGv4";

async function getAuthClient() {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentialsJson) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY environment variable is required"
    );
  }

  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth.getClient();
}

function loadAllResults() {
  const files = fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const allResults = [];
  for (const file of files) {
    const data = JSON.parse(
      fs.readFileSync(path.join(RESULTS_DIR, file), "utf-8")
    );
    allResults.push(...data);
  }
  return allResults;
}

function formatRow(entry) {
  const m = entry.psi_mobile;
  const d = entry.psi_desktop;
  const lh = entry.lighthouse_cli;

  return [
    entry.date,
    entry.url,
    // PSI Mobile scores
    m?.scores?.performance != null ? (m.scores.performance * 100).toFixed(0) : "",
    m?.scores?.accessibility != null ? (m.scores.accessibility * 100).toFixed(0) : "",
    m?.scores?.best_practices != null ? (m.scores.best_practices * 100).toFixed(0) : "",
    m?.scores?.seo != null ? (m.scores.seo * 100).toFixed(0) : "",
    // PSI Mobile lab
    m?.lab?.page_load_ms != null ? (m.lab.page_load_ms / 1000).toFixed(2) : "",
    m?.lab?.dom_content_loaded_ms != null ? (m.lab.dom_content_loaded_ms / 1000).toFixed(2) : "",
    m?.lab?.lcp_ms != null ? (m.lab.lcp_ms / 1000).toFixed(2) : "",
    m?.lab?.fcp_ms != null ? (m.lab.fcp_ms / 1000).toFixed(2) : "",
    m?.lab?.cls != null ? m.lab.cls.toFixed(3) : "",
    m?.lab?.tbt_ms != null ? m.lab.tbt_ms.toFixed(0) : "",
    m?.lab?.si_ms != null ? (m.lab.si_ms / 1000).toFixed(2) : "",
    m?.lab?.tti_ms != null ? (m.lab.tti_ms / 1000).toFixed(2) : "",
    // PSI Desktop scores
    d?.scores?.performance != null ? (d.scores.performance * 100).toFixed(0) : "",
    d?.scores?.accessibility != null ? (d.scores.accessibility * 100).toFixed(0) : "",
    d?.scores?.best_practices != null ? (d.scores.best_practices * 100).toFixed(0) : "",
    d?.scores?.seo != null ? (d.scores.seo * 100).toFixed(0) : "",
    // PSI Desktop lab
    d?.lab?.page_load_ms != null ? (d.lab.page_load_ms / 1000).toFixed(2) : "",
    d?.lab?.dom_content_loaded_ms != null ? (d.lab.dom_content_loaded_ms / 1000).toFixed(2) : "",
    d?.lab?.lcp_ms != null ? (d.lab.lcp_ms / 1000).toFixed(2) : "",
    d?.lab?.fcp_ms != null ? (d.lab.fcp_ms / 1000).toFixed(2) : "",
    d?.lab?.cls != null ? d.lab.cls.toFixed(3) : "",
    d?.lab?.tbt_ms != null ? d.lab.tbt_ms.toFixed(0) : "",
    d?.lab?.si_ms != null ? (d.lab.si_ms / 1000).toFixed(2) : "",
    d?.lab?.tti_ms != null ? (d.lab.tti_ms / 1000).toFixed(2) : "",
    // PSI Field data (CrUX)
    m?.field?.lcp_ms != null ? (m.field.lcp_ms / 1000).toFixed(2) : "",
    m?.field?.inp_ms != null ? m.field.inp_ms.toFixed(0) : "",
    m?.field?.cls != null ? m.field.cls.toFixed(3) : "",
    m?.field?.ttfb_ms != null ? m.field.ttfb_ms.toFixed(0) : "",
    // Lighthouse CLI
    lh?.performance_score != null ? (lh.performance_score * 100).toFixed(0) : "",
    lh?.page_load_ms != null ? (lh.page_load_ms / 1000).toFixed(2) : "",
    lh?.lcp_ms != null ? (lh.lcp_ms / 1000).toFixed(2) : "",
    lh?.fcp_ms != null ? (lh.fcp_ms / 1000).toFixed(2) : "",
    lh?.cls != null ? lh.cls.toFixed(3) : "",
    lh?.tbt_ms != null ? lh.tbt_ms.toFixed(0) : "",
    // Errors
    entry.errors?.length > 0
      ? entry.errors.map((e) => e.source).join(", ")
      : "",
  ];
}

const HEADERS = [
  "Date",
  "URL",
  // PSI Mobile
  "Mobile Perf",
  "Mobile A11y",
  "Mobile Best Practices",
  "Mobile SEO",
  "Mobile Page Load (s)",
  "Mobile DOM Loaded (s)",
  "Mobile LCP (s)",
  "Mobile FCP (s)",
  "Mobile CLS",
  "Mobile TBT (ms)",
  "Mobile Speed Index (s)",
  "Mobile TTI (s)",
  // PSI Desktop
  "Desktop Perf",
  "Desktop A11y",
  "Desktop Best Practices",
  "Desktop SEO",
  "Desktop Page Load (s)",
  "Desktop DOM Loaded (s)",
  "Desktop LCP (s)",
  "Desktop FCP (s)",
  "Desktop CLS",
  "Desktop TBT (ms)",
  "Desktop Speed Index (s)",
  "Desktop TTI (s)",
  // Field
  "Field LCP (s)",
  "Field INP (ms)",
  "Field CLS",
  "Field TTFB (ms)",
  // Lighthouse CLI
  "LH Perf",
  "LH Page Load (s)",
  "LH LCP (s)",
  "LH FCP (s)",
  "LH CLS",
  "LH TBT (ms)",
  // Errors
  "Errors",
];

async function syncToSheets() {
  console.log("Authenticating with Google Sheets...");
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const allResults = loadAllResults();
  if (allResults.length === 0) {
    console.log("No results to sync.");
    return;
  }

  // Check if the sheet already has data to determine what's new
  let existingRows = 0;
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:A",
    });
    existingRows = existing.data.values?.length || 0;
  } catch {
    existingRows = 0;
  }

  const rows = allResults.map(formatRow);

  if (existingRows === 0) {
    // First time — write headers + all data
    console.log(`Writing headers + ${rows.length} rows...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADERS, ...rows],
      },
    });

    // Bold the header row and freeze it
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                },
              },
              fields: "userEnteredFormat(textFormat,backgroundColor)",
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: HEADERS.length },
            },
          },
        ],
      },
    });
  } else {
    // Append only new rows (rows after what already exists, minus the header)
    const newRows = rows.slice(Math.max(0, existingRows - 1));
    if (newRows.length === 0) {
      console.log("No new data to append.");
      return;
    }
    console.log(`Appending ${newRows.length} new rows...`);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:A",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: newRows,
      },
    });
  }

  console.log(
    `Google Sheets synced: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`
  );
}

syncToSheets().catch((err) => {
  console.error("Sheets sync error:", err.message);
  process.exit(1);
});
