/**
 * /api/sms.js
 *
 * CASE A — Cron trigger: POST { "trigger": "cron" }
 *   Requires Authorization: Bearer <DASHBOARD_TOKEN>
 *   Fetches tomorrow's Google Calendar events and sends SMS reminders via mNotify.
 *   Returns { sent, skipped, failed }
 *
 * CASE B — Manual SMS: POST { token, password, phone, message }
 *   Standard dashboard-auth manual SMS send.
 *   Returns { success: true }
 */

const { authRequest } = require("./_auth");
const { google } = require("googleapis");

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = ["https://rivershub.vercel.app", "http://localhost:3000"];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── Phone normalisation ───────────────────────────────────────────────────────
function normalisePhone(phone) {
  let n = phone.replace(/[\s\-\(\)]/g, "");
  if (n.startsWith("0")) n = "233" + n.slice(1);
  if (n.startsWith("+")) n = n.slice(1);
  return n;
}

// ── mNotify sender ────────────────────────────────────────────────────────────
async function sendMnotify(phone, message) {
  const response = await fetch("https://api.mnotify.com/api/sms/quick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key:           process.env.MNOTIFY_API_KEY,
      recipient:     [normalisePhone(phone)],
      message:       message,
      sender:        process.env.MNOTIFY_SENDER_ID || "RiversDent",
      is_schedule:   "false",
      schedule_date: "",
    }),
  });
  const data = await response.json();
  if (!response.ok || data.status !== "success") {
    throw new Error(`mNotify error: ${data?.message || JSON.stringify(data)}`);
  }
  return data;
}

// ── Date helpers (Ghana = UTC+0, no DST) ─────────────────────────────────────
function getTomorrowDateStr() {
  // Ghana is UTC+0 year-round, so UTC date IS Ghana date
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + 1);
  const yyyy = t.getUTCFullYear();
  const mm   = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(t.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
}

// ── Cron handler: fetch calendar and send reminders ───────────────────────────
async function handleCron(req, res) {
  // Verify Bearer token
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || token !== process.env.DASHBOARD_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_CALENDAR_ID) {
    return res.status(500).json({ error: "Google Calendar env vars not configured" });
  }
  if (!process.env.MNOTIFY_API_KEY) {
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured" });
  }

  const tomorrowStr = getTomorrowDateStr();
  // Construct UTC midnight boundaries — Ghana=UTC so this is midnight–23:59:59 Ghana time
  const timeMin = new Date(tomorrowStr + "T00:00:00Z").toISOString();
  const timeMax = new Date(tomorrowStr + "T23:59:59Z").toISOString();

  console.log(`[sms-cron] Fetching appointments for ${tomorrowStr}`);

  let events;
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });
    const calendar = google.calendar({ version: "v3", auth });
    const response = await calendar.events.list({
      calendarId:   process.env.GOOGLE_CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy:      "startTime",
      maxResults:   50,
    });
    events = response.data.items || [];
  } catch (err) {
    console.error("[sms-cron] Calendar fetch error:", err.message);
    return res.status(500).json({ error: `Calendar fetch failed: ${err.message}` });
  }

  console.log(`[sms-cron] ${events.length} event(s) found for ${tomorrowStr}`);

  let sent = 0, skipped = 0, failed = 0;

  for (const event of events) {
    const desc       = event.description || "";
    const phoneMatch = desc.match(/^Phone:\s*(.+)/m);
    const nameMatch  = desc.match(/^Patient:\s*(.+)/m);
    const phone      = phoneMatch ? phoneMatch[1].trim() : null;
    const name       = nameMatch  ? nameMatch[1].trim()  : (event.summary || "Patient");

    if (!phone) {
      console.log(`[sms-cron] No phone for "${event.summary}" — skipping`);
      skipped++;
      continue;
    }

    const start   = new Date(event.start.dateTime || event.start.date);
    const timeStr = start.toLocaleTimeString("en-GH", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Accra",
    });

    const message =
      `Hello ${name}, this is a reminder that your appointment is scheduled` +
      ` for ${tomorrowStr} at ${timeStr}.` +
      ` Please call 030 244 8742 if you would like to reschedule.`;

    try {
      await sendMnotify(phone, message);
      console.log(`[sms-cron] ✅ Sent to ${name} (${phone})`);
      sent++;
    } catch (smsErr) {
      console.error(`[sms-cron] ❌ Failed for ${name}: ${smsErr.message}`);
      failed++;
    }

    // 300ms gap between sends to stay within rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[sms-cron] Done — sent: ${sent}, skipped: ${skipped}, failed: ${failed}`);
  return res.status(200).json({ sent, skipped, failed, date: tomorrowStr });
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }

  // CASE A — cron trigger
  if (body && body.trigger === "cron") {
    return handleCron(req, res);
  }

  // CASE B — manual SMS
  if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

  const { phone, message } = body;
  if (!phone)   return res.status(400).json({ error: "phone is required" });
  if (!message) return res.status(400).json({ error: "message is required" });
  if (!process.env.MNOTIFY_API_KEY)
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured on server" });

  try {
    const response = await fetch("https://api.mnotify.com/api/sms/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key:           process.env.MNOTIFY_API_KEY,
        recipient:     [normalisePhone(phone)],
        message:       message,
        sender:        process.env.MNOTIFY_SENDER_ID || "RiversDent",
        is_schedule:   "false",
        schedule_date: "",
      }),
    });
    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      const errMsg = data?.message || JSON.stringify(data);
      console.error("[sms] mNotify error response:", errMsg);
      return res.status(500).json({ error: `SMS provider error: ${errMsg}` });
    }

    console.log(`[sms] ✅ Sent to ${phone}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[sms] Fetch error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
