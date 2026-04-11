/**
 * /api/invoices.js  — multi-line invoice support with edit (PATCH) + history
 * GET    /api/invoices?token=&password=&ref=RDC/26/001
 * GET    /api/invoices?token=&password=&history=INVOICE_ID
 * POST   /api/invoices  { token, password, reference_number, date, invoice_number, ... items:[] }
 * POST   /api/invoices  { token, password, action:"email", to, invoiceHtml, invoiceNumber }
 * PATCH  /api/invoices  { token, password, id, ...fields, items:[] }
 * PUT    /api/invoices  { token, password, id, paid }
 * DELETE /api/invoices  { token, password, id }
 */

const { authRequest } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");

// ── Supabase singleton ────────────────────────────────────────────────────────
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabase;
}

// ── Gmail API sender (HTTPS — no SMTP ports, works on Vercel) ─────────────────
async function sendViaGmailAPI({ to, subject, html }) {
  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const gmailUser    = process.env.GMAIL_USER;

  if (!clientId || !clientSecret || !refreshToken || !gmailUser) {
    throw new Error(
      "Missing Gmail OAuth2 env vars. Need: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER"
    );
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  // Build a raw RFC-2822 message and base64url-encode it
  const messageParts = [
    `From: "Rivers Dental Clinic" <${gmailUser}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ];
  const raw = Buffer.from(messageParts.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

// ── Invoice history helper ────────────────────────────────────────────────────
async function writeHistory(supabase, invoiceId, invoice, items, note) {
  await supabase.from("invoice_history").insert({
    invoice_id:       invoiceId,
    grand_total:      invoice.grand_total,
    amount_paid:      invoice.amount_paid,
    amount_remaining: invoice.amount_remaining,
    discount_amount:  invoice.discount_amount,
    paid:             invoice.paid,
    note:             note || null,
    snapshot_items:   items || null,
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
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

  const supabase = getSupabase();

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

    if (req.query.history) {
      const { data, error } = await supabase
        .from("invoice_history")
        .select("*")
        .eq("invoice_id", req.query.history)
        .order("changed_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ history: data });
    }

    if (!req.query.ref) return res.status(400).json({ error: "ref is required" });
    const { data: invoices, error: iErr } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("reference_number", req.query.ref)
      .order("date", { ascending: false });
    if (iErr) return res.status(500).json({ error: iErr.message });
    const total  = invoices.reduce((s, i) => s + parseFloat(i.grand_total || 0), 0);
    const unpaid = invoices.filter(i => !i.paid).reduce((s, i) => s + parseFloat(i.amount_remaining || 0), 0);
    return res.status(200).json({ invoices, total, unpaid });
  }

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }
  if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

  // ── POST ──────────────────────────────────────────────────────────────────
  if (req.method === "POST") {

    // ── Email action ─────────────────────────────────────────────────────────
    if (body.action === "email") {
      const { to, invoiceHtml, invoiceNumber } = body;
      if (!to)          return res.status(400).json({ error: "to (email address) is required" });
      if (!invoiceHtml) return res.status(400).json({ error: "invoiceHtml is required" });

      const subject = `Invoice ${invoiceNumber ? `#${invoiceNumber}` : ""} — Rivers Dental Clinic`;
      console.log(`[invoices] 📧 Sending invoice email to ${to} via Gmail API`);

      try {
        await sendViaGmailAPI({ to, subject, html: invoiceHtml });
        console.log(`[invoices] ✅ Invoice emailed successfully to ${to}`);
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("[invoices] ❌ Gmail API email failed:", err.message);
        return res.status(500).json({ error: `Failed to send email: ${err.message}` });
      }
    }

    // ── Create invoice ────────────────────────────────────────────────────────
    const { token, password, items, ...fields } = body;
    if (!fields.reference_number || !fields.date || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "reference_number, date and items[] are required" });

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert(fields)
      .select()
      .single();
    if (invErr) return res.status(500).json({ error: invErr.message });

    const rows = items.map(it => ({ invoice_id: inv.id, ...it }));
    const { error: liErr } = await supabase.from("invoice_items").insert(rows);
    if (liErr) return res.status(500).json({ error: liErr.message });

    await writeHistory(supabase, inv.id, inv, items, "Invoice created");
    return res.status(200).json({ success: true, invoice: inv });
  }

  // ── PATCH ─────────────────────────────────────────────────────────────────
  if (req.method === "PATCH") {
    const { token, password, id, items, ...fields } = body;
    if (!id) return res.status(400).json({ error: "id is required" });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "items[] is required" });

    const { data: inv, error: iErr } = await supabase
      .from("invoices").update(fields).eq("id", id).select().single();
    if (iErr) return res.status(500).json({ error: iErr.message });

    const { error: delErr } = await supabase.from("invoice_items").delete().eq("invoice_id", id);
    if (delErr) return res.status(500).json({ error: delErr.message });

    const rows = items.map(it => ({ invoice_id: id, ...it }));
    const { error: liErr } = await supabase.from("invoice_items").insert(rows);
    if (liErr) return res.status(500).json({ error: liErr.message });

    const note = inv.paid ? "Marked as fully paid" : "Invoice updated";
    await writeHistory(supabase, id, inv, items, note);
    return res.status(200).json({ success: true, invoice: inv });
  }

  // ── PUT ───────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    if (!body.id) return res.status(400).json({ error: "id is required" });

    const { data: current, error: fetchErr } = await supabase
      .from("invoices").select("grand_total").eq("id", body.id).single();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message });

    const updateFields = { paid: body.paid };
    if (body.paid) {
      updateFields.amount_paid      = current.grand_total;
      updateFields.amount_remaining = 0;
    }

    const { data, error } = await supabase
      .from("invoices").update(updateFields).eq("id", body.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await writeHistory(supabase, body.id, data, null, body.paid ? "Marked paid" : "Marked unpaid");
    return res.status(200).json({ success: true, invoice: data });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    if (!body.id) return res.status(400).json({ error: "id is required" });
    const { error } = await supabase.from("invoices").delete().eq("id", body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
