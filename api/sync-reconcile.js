/**
 * /api/sync-reconcile.js
 *
 * Compares Supabase patients against Google Sheets Patient_data tab and
 * fixes any inconsistencies. Can be triggered in two ways:
 *
 * GET  /api/sync-reconcile?sync_token=...&dry_run=true
 *      → Returns a report of what is out of sync (no changes made)
 *
 * POST /api/sync-reconcile  { sync_token, dry_run: false }
 *      → Performs the fixes:
 *        • Rows in Sheets but NOT in Supabase → deleted from Sheets
 *        • Rows in Supabase but NOT in Sheets → added to Sheets
 *        • No changes to Supabase data (Supabase is the source of truth)
 *
 * Auth: uses SYNC_TOKEN (same as Apps Script) — no dashboard password needed
 * so it can be called from the Google Apps Script reconciliation job too.
 */

const { createClient } = require("@supabase/supabase-js");
const { google }       = require("googleapis");

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

const GENDER_MAP       = { 0: "MALE", 1: "FEMALE" };
const AGE_CATEGORY_MAP = { 0: "CHILD", 1: "TEENAGER", 2: "ADULT", 3: "SENIOR" };

// Build a Sheets row array from a patient object (columns A–O)
function buildRow(p, timestamp = "") {
  return [
    timestamp,
    p.reference_number    || "",
    p.name                || "",
    p.gender !== null && p.gender !== undefined ? (GENDER_MAP[p.gender] || "") : "",
    p.age_category !== null && p.age_category !== undefined ? (AGE_CATEGORY_MAP[p.age_category] || "") : "",
    p.phone               || "",
    p.whatsapp            || "",
    p.birthdate           || "",
    p.email               || "",
    p.city                || "",
    p.company             || "",
    p.profession          || "",
    p.emergency_contact_name      || "",
    p.emergency_contact_relation  || "",
    p.emergency_contact_phone     || "",
  ];
}

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://rivershub.vercel.app", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Auth — SYNC_TOKEN only (allows Apps Script to call this)
  const token =
    req.query.sync_token ||
    (req.body && (typeof req.body === "string" ? JSON.parse(req.body) : req.body).sync_token);
  if (token !== process.env.SYNC_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isDryRun = req.query.dry_run === "true" ||
    (req.body && (typeof req.body === "string" ? JSON.parse(req.body) : req.body).dry_run === true);

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return res.status(500).json({ error: "GOOGLE_SHEET_ID not configured" });

  try {
    const supabase = getSupabase();
    const sheets   = getSheets();

    // ── 1. Fetch ALL patients from Supabase ─────────────────────────────────
    const { data: dbPatients, error: dbErr } = await supabase
      .from("patients")
      .select("*")
      .order("reference_number", { ascending: true });
    if (dbErr) return res.status(500).json({ error: "Supabase error: " + dbErr.message });

    const dbMap = new Map(); // reference_number → patient object
    for (const p of dbPatients) dbMap.set(p.reference_number, p);

    // ── 2. Fetch ALL rows from Google Sheets ─────────────────────────────────
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Patient_data!A:O",
    });
    const sheetRows = sheetRes.data.values || [];
    // sheetRows[0] is the header row — skip it
    // Column B (index 1) is reference_number

    const sheetMap = new Map(); // reference_number → { rowIndex (1-based), rowData }
    for (let i = 1; i < sheetRows.length; i++) {
      const ref = (sheetRows[i][1] || "").trim();
      if (ref) sheetMap.set(ref, { rowIndex: i + 1, rowData: sheetRows[i] });
    }

    // ── 3. Find inconsistencies ──────────────────────────────────────────────
    const onlyInSheets   = []; // in Sheets but not Supabase → should be deleted from Sheets
    const onlyInSupabase = []; // in Supabase but not Sheets → should be added to Sheets
    const report = { dry_run: isDryRun, timestamp: new Date().toISOString() };

    for (const [ref] of sheetMap) {
      if (!dbMap.has(ref)) onlyInSheets.push(ref);
    }
    for (const [ref] of dbMap) {
      if (!sheetMap.has(ref)) onlyInSupabase.push(ref);
    }

    report.total_in_supabase = dbMap.size;
    report.total_in_sheets   = sheetMap.size;
    report.only_in_sheets    = onlyInSheets;    // stale rows to delete
    report.only_in_supabase  = onlyInSupabase;  // missing rows to add

    if (isDryRun || (onlyInSheets.length === 0 && onlyInSupabase.length === 0)) {
      report.action = isDryRun ? "dry_run_no_changes_made" : "already_in_sync";
      return res.status(200).json(report);
    }

    const batchRequests = [];

    // ── 4. Delete stale Sheets rows (in Sheets but not Supabase) ────────────
    // Must delete from bottom to top to preserve row indices
    const rowsToDelete = onlyInSheets
      .map(ref => sheetMap.get(ref).rowIndex)
      .sort((a, b) => b - a); // descending

    if (rowsToDelete.length > 0) {
      // Look up the real numeric grid ID for Patient_data tab
      const spreadMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const tab = spreadMeta.data.sheets.find(s => s.properties.title === "Patient_data");
      if (!tab) throw new Error("Patient_data tab not found in spreadsheet");
      const gridId = tab.properties.sheetId; // real ID, not assumed to be 0

      for (const rowIndex of rowsToDelete) {
        batchRequests.push({
          deleteDimension: {
            range: {
              sheetId:    gridId,
              dimension:  "ROWS",
              startIndex: rowIndex - 1,
              endIndex:   rowIndex,
            }
          }
        });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: batchRequests },
      });
    }

    // ── 5. Add missing rows (in Supabase but not Sheets) ─────────────────────
    if (onlyInSupabase.length > 0) {
      const newRows = onlyInSupabase.map(ref => {
        const p = dbMap.get(ref);
        const ts = p.created_at ? new Date(p.created_at).toISOString() : "";
        return buildRow(p, ts);
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Patient_data!A:O",
        valueInputOption: "RAW",
        requestBody: { values: newRows },
      });
    }

    report.action              = "fixed";
    report.deleted_from_sheets = onlyInSheets.length;
    report.added_to_sheets     = onlyInSupabase.length;

    console.log(`[sync-reconcile] ✅ Fixed: deleted ${onlyInSheets.length}, added ${onlyInSupabase.length}`);
    return res.status(200).json(report);

  } catch (err) {
    console.error("[sync-reconcile] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
