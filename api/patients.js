/**
 * /api/patients.js
 * GET    /api/patients?token=&password=&search=&page=&limit=&ref=RDC/26/001
 * GET    /api/patients?token=&password=&action=next-ref   ← generate next reference
 * POST   /api/patients  { token, password, ...patientFields }
 * PUT    /api/patients  { token, password, reference_number, ...fields }
*/

const { authRequest } = require("./_auth");
const { applyCors } = require("./_cors");
const { validatePatient } = require("./_validate");
const { createClient } = require("@supabase/supabase-js");
const { google }       = require("googleapis");

// waitUntil keeps the function alive after the response is sent (Vercel).
// If it can't load (e.g. local dev), we fall back to awaiting the work.
let waitUntil = null;
try { ({ waitUntil } = require("@vercel/functions")); } catch { waitUntil = null; }

async function background(promise) {
  if (typeof waitUntil === "function") { waitUntil(promise); return; }
  await promise;
}

const SHEET_COLUMNS = [
  "reference_number", "name", "gender", "age_category",
  "phone", "whatsapp", "birthdate", "email",
  "city", "company", "profession",
  "emergency_contact_name", "emergency_contact_relation", "emergency_contact_phone"
];

const GENDER_MAP       = { 0: "MALE", 1: "FEMALE" };
const AGE_CATEGORY_MAP = { 0: "CHILD", 1: "TEENAGER", 2: "ADULT", 3: "SENIOR" };

// Module-level singleton — created once, reused across all requests
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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


// ─── Generate next reference number ──────────────────────────────────────────
// Uses a Postgres function (get_next_reference) that runs atomically,
// preventing duplicate references when two patients register simultaneously.
async function getNextReference(supabase) {
  const { data, error } = await supabase.rpc("get_next_reference");
  if (error) throw new Error("Failed to generate reference number: " + error.message);
  return data;
}

// ─── Sync patient row to Google Sheets ───────────────────────────────────────
async function syncToSheets(patient, isNew) {
  if (!process.env.GOOGLE_SHEET_ID) return;
  try {
    const sheets   = getSheets();
    const sheetId  = process.env.GOOGLE_SHEET_ID;
    const range    = "Patient_data!A:O";

    // Build the row values in sheet column order
    // Sheet columns: Timestamp | Reference | Name | Gender | Age Category |
    //                Phone | WhatsApp | Birthdate | Email | City |
    //                Company | Profession | Emergency Name | Emergency Relation | Emergency Phone
    const now = new Date().toISOString();
    const row = [
      isNew ? now : "",                                          // Timestamp (only for new rows)
      patient.reference_number                        || "",
      patient.name                                    || "",
      patient.gender !== null && patient.gender !== undefined
        ? (GENDER_MAP[patient.gender] || "")          : "",
      patient.age_category !== null && patient.age_category !== undefined
        ? (AGE_CATEGORY_MAP[patient.age_category] || "") : "",
      patient.phone                                   || "",
      patient.whatsapp                                || "",
      patient.birthdate                               || "",
      patient.email                                   || "",
      patient.city                                    || "",
      patient.company                                 || "",
      patient.profession                              || "",
      patient.emergency_contact_name                  || "",
      patient.emergency_contact_relation              || "",
      patient.emergency_contact_phone                 || "",
    ];

    if (isNew) {
      // Get current data to find the true last row
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Patient_data!B:B",
      });
      const lastRow = (existing.data.values || []).length + 1; // +1 for next empty row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `Patient_data!A${lastRow}:O${lastRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    } else {
      // Find existing row by reference number and update it
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Patient_data!B:B", // Reference number column
      });

      const rows = existing.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === patient.reference_number) {
          rowIndex = i + 1; // 1-based
          break;
        }
      }

      if (rowIndex > 0) {
        // Update existing row — keep timestamp, update everything else
        const updateRow = [...row];
        updateRow[0] = ""; // Don't overwrite timestamp
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `Patient_data!A${rowIndex}:O${rowIndex}`,
          valueInputOption: "RAW",
          requestBody: { values: [updateRow] },
        });
      } else {
        // Row not found in sheet — find true last row and write there
        const lastRowData = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: "Patient_data!B:B",
        });
        const lastRow = (lastRowData.data.values || []).length + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `Patient_data!A${lastRow}:O${lastRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [row] },
        });
      }
    }
  } catch (err) {
    console.error("[patients] Sheets sync error:", err.message);
    // Don't fail the request if sheets sync fails
  }
}

// ─── Delete patient row from Google Sheets ────────────────────────────────────
async function deleteFromSheets(reference_number) {
  if (!process.env.GOOGLE_SHEET_ID) return;
  try {
    const sheets  = getSheets();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // Find the row index by scanning column B
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Patient_data!B:B",
    });

    const rows = existing.data.values || [];
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === reference_number) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex < 0) {
      console.log(`[patients] Row ${reference_number} not found in Sheets — nothing to delete`);
      return;
    }

    // Look up the real numeric grid ID for Patient_data tab
    const spreadMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tab = spreadMeta.data.sheets.find(s => s.properties.title === "Patient_data");
    if (!tab) throw new Error("Patient_data tab not found in spreadsheet");
    const gridId = tab.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId:    gridId,     // ← real grid ID, not hardcoded 0       // ← use the real grid ID
              dimension:  "ROWS",
              startIndex: rowIndex - 1,
              endIndex:   rowIndex,
            }
          }
        }]
      }
    });

    console.log(`[patients] ✅ Deleted row ${reference_number} from Sheets (row ${rowIndex})`);
  } catch (err) {
    console.error("[patients] Sheets delete error:", err.message);
  }
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  const supabase = getSupabase();

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {

    // Public endpoint — requires SYNC_TOKEN (used by Apps Script, no staff password needed)
    if (req.query.action === "next-ref-public") {
      if (req.query.sync_token !== process.env.SYNC_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const ref = await getNextReference(supabase);
      return res.status(200).json({ reference: ref });
    }

    if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

    // Generate next reference number (authenticated)
    if (req.query.action === "next-ref") {
      const ref = await getNextReference(supabase);
      return res.status(200).json({ reference: ref });
    }

    // Single patient
    if (req.query.ref) {
      const { data, error } = await supabase
        .from("patients").select("*")
        .eq("reference_number", req.query.ref).single();
      if (error) return res.status(404).json({ error: "Patient not found" });
      return res.status(200).json({ patient: data });
    }

    // List with search and pagination
    const page   = parseInt(req.query.page  || "1");
    const limit = Math.min(parseInt(req.query.limit || "20"), 50);
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    let query = supabase
      .from("patients")
      .select("reference_number,name,phone,gender,age_category,created_at", { count: "exact" })      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      // Name uses contains, reference and phone use starts-with
      query = query.or(
        `name.ilike.%${search}%,` +
        `reference_number.ilike.${search}%,` +
        `phone.ilike.${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ patients: data, total: count, page, limit });
  }

  // ── POST — create patient ─────────────────────────────────────────────────
  if (req.method === "POST") {
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: "Invalid JSON" }); }
    if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

    const { token, password, ...rawFields } = body;

    // Server assigns the reference at save time unless one is explicitly supplied
    const autoRef = !rawFields.reference_number;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (autoRef) rawFields.reference_number = await getNextReference(supabase);

      const { valid, errors, cleaned } = validatePatient(rawFields);
      if (!valid) return res.status(400).json({ error: errors.join(", ") });

      // True insert: never overwrites an existing patient
      const { data, error } = await supabase
        .from("patients").insert(cleaned).select().single();

      if (!error) {
        await background(syncToSheets(data, true));
        return res.status(200).json({ success: true, patient: data });
      }
      if (error.code === "23505") {            // unique violation
        if (autoRef) continue;                 // counter hit a taken number, try the next
        return res.status(409).json({ error: `Patient ${rawFields.reference_number} already exists` });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(409).json({ error: "Could not assign a unique reference number. Please try again." });
  }

  // ── PUT — update patient ──────────────────────────────────────────────────
  if (req.method === "PUT") {
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: "Invalid JSON" }); }
    if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!body.reference_number) return res.status(400).json({ error: "reference_number is required" });

    const { token, password, reference_number, ...rawFields } = body;

    // Validate and sanitise input
    rawFields.reference_number = reference_number;
    const { valid, errors, cleaned } = validatePatient(rawFields);
    if (!valid) return res.status(400).json({ error: errors.join(", ") });
    const { reference_number: _ref, ...updateFields } = cleaned;

    const { data, error } = await supabase
      .from("patients")
      .update(updateFields)
      .eq("reference_number", reference_number)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });

    // Sync to Google Sheets asynchronously — don't block the response
    await background(syncToSheets({ ...data, reference_number }, false));

    return res.status(200).json({ success: true, patient: data });
  }

  // ── DELETE — remove patient from Supabase + Google Sheets ────────────────
  if (req.method === "DELETE") {
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: "Invalid JSON" }); }
    if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!body.reference_number) return res.status(400).json({ error: "reference_number is required" });

    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("reference_number", body.reference_number);

    if (error) return res.status(500).json({ error: error.message });

    // Delete from Google Sheets asynchronously
    await background(deleteFromSheets(body.reference_number));

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
