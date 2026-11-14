/**
 * /api/sms.js — Phase 5 SMS expansion
 *
 * CASE A — Appointment reminders: POST { "trigger": "cron" }
 *   Fetches tomorrow's Google Calendar events, sends reminders via mNotify.
 *
 * CASE B — Birthday SMS: POST { "trigger": "birthday" }
 *   Checks patients with birthdate matching today (MM-DD), sends birthday wish.
 *
 * CASE C — Holiday SMS: POST { "trigger": "holiday" }
 *   Checks if today is a Ghana public holiday, sends greeting to all patients with phone.
 *
 * CASE D — Review/Recall SMS: POST { "trigger": "review" }
 *   Checks invoices with procedures having review intervals; sends reminder if due within 7 days.
 *
 * CASE E — Follow-up SMS: POST { "trigger": "followup" }
 *   Checks patients with last invoice ~3 months ago, sends retention message.
 *
 * CASE F — Manual SMS: POST { token, password, phone, message }
 *   Standard dashboard auth, manual SMS send.
 */

const { authRequest } = require("./_auth");
const { google } = require("googleapis");
const { applyCors } = require("./_cors");
const { createClient } = require("@supabase/supabase-js");

// ── Ghana public holidays (MM-DD, message) ──────────────────────────────────
const GHANA_HOLIDAYS = [
  { date: "01-01", name: "New Year's Day", message: "Happy New Year! Wishing you a healthy and bright year from Rivers Dental Clinic." },
  { date: "03-06", name: "Founders' Day", message: "Happy Founders' Day! Thank you for being part of our dental family." },
  { date: "12-25", name: "Christmas Day", message: "Merry Christmas from Rivers Dental Clinic! Wishing you joy and great oral health." },
  { date: "12-26", name: "Boxing Day", message: "Happy Boxing Day! Hope you're having a wonderful time with loved ones." },
];

// ── Follow-up SMS recurring dates (MM-DD) — 4-5 times per year ────────────────
// Starting from 02-14 (Valentine's Day), then every ~3 months: Feb, May, Aug, Nov
const FOLLOWUP_SMS_DATES = [
  "02-14", // Mid-February
  "05-15", // Mid-May
  "08-15", // Mid-August
  "11-15", // Mid-November
];

// ── Phone normalisation ──────────────────────────────────────────────────────
function normalisePhone(phone) {
  let n = phone.replace(/[\s\-\(\)]/g, "");
  if (n.startsWith("0")) n = "233" + n.slice(1);
  if (n.startsWith("+")) n = n.slice(1);
  return n;
}

// ── Title case (full name) ───────────────────────────────────────────────────
function titleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ── mNotify sender ───────────────────────────────────────────────────────────
async function sendMnotify(phone, message) {
  const response = await fetch("https://api.mnotify.com/api/sms/quick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: process.env.MNOTIFY_API_KEY,
      recipient: [normalisePhone(phone)],
      message: message,
      sender: process.env.MNOTIFY_SENDER_ID || "RiversDent",
      is_schedule: "false",
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
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + 1);
  const yyyy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayDateStr() {
  const t = new Date();
  const yyyy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayMonthDay() {
  const t = new Date();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

function getDateMonthDay(dateStr) {
  const d = new Date(dateStr);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

function calculateDueDate(invoiceDate, reviewMonths) {
  const d = new Date(invoiceDate);
  d.setMonth(d.getMonth() + reviewMonths);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isWithin7Days(dateStr) {
  const today = new Date(getTodayDateStr());
  const target = new Date(dateStr);
  const diff = (target - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

function get3MonthsAgoDateStr() {
  const t = new Date();
  t.setMonth(t.getMonth() - 3);
  const yyyy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ── Verify Bearer token ──────────────────────────────────────────────────────
function verifyBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || token !== process.env.DASHBOARD_TOKEN) {
    return false;
  }
  return true;
}

// ── Supabase client ──────────────────────────────────────────────────────────
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase env vars not configured");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ──────────────────────────────────────────────────────────────────────────────
// CASE A: Appointment reminders (cron)
// ──────────────────────────────────────────────────────────────────────────────
async function handleCron(req, res) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_CALENDAR_ID) {
    return res.status(500).json({ error: "Google Calendar env vars not configured" });
  }
  if (!process.env.MNOTIFY_API_KEY) {
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured" });
  }

  const tomorrowStr = getTomorrowDateStr();
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
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });
    events = response.data.items || [];
  } catch (err) {
    console.error("[sms-cron] Calendar fetch error:", err.message);
    return res.status(500).json({ error: `Calendar fetch failed: ${err.message}` });
  }

  console.log(`[sms-cron] ${events.length} event(s) found for ${tomorrowStr}`);

  let sent = 0,
    skipped = 0,
    failed = 0;

  for (const event of events) {
    const desc = event.description || "";
    const phoneMatch = desc.match(/^Phone:\s*(.+)/m);
    const nameMatch = desc.match(/^Patient:\s*(.+)/m);
    const phone = phoneMatch ? phoneMatch[1].trim() : null;
    const name = nameMatch ? nameMatch[1].trim() : event.summary || "Patient";

    if (!phone) {
      console.log(`[sms-cron] No phone for "${event.summary}" — skipping`);
      skipped++;
      continue;
    }

    const start = new Date(event.start.dateTime || event.start.date);
    const timeStr = start.toLocaleTimeString("en-GH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Accra",
    });

    const message =
      `Hello ${titleCase(name)}, this is a reminder that your appointment is scheduled` +
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

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[sms-cron] Done — sent: ${sent}, skipped: ${skipped}, failed: ${failed}`);
  return res.status(200).json({ sent, skipped, failed, date: tomorrowStr });
}

// ──────────────────────────────────────────────────────────────────────────────
// CASE B: Birthday SMS
// ──────────────────────────────────────────────────────────────────────────────
async function handleBirthday(req, res) {
  if (!process.env.MNOTIFY_API_KEY) {
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured" });
  }

  try {
    const supabase = getSupabaseClient();
    const todayMonthDay = getTodayMonthDay();

    // Fetch all patients with birthdate matching today (ignore year) and NOT opted out
    const { data: patients, error } = await supabase
      .from("patients")
      .select("reference_number, name, phone, birthdate, sms_optout_birthday")
      .neq("phone", null)
      .not("phone", "eq", "")
      .eq("sms_optout_birthday", false);

    if (error) throw error;

    const birthdays = patients.filter((p) => {
      if (!p.birthdate) return false;
      return getDateMonthDay(p.birthdate) === todayMonthDay;
    });

    console.log(`[sms-birthday] Found ${birthdays.length} birthday(s) today`);

    let sent = 0,
      skipped = 0,
      failed = 0;

    for (const patient of birthdays) {
      const message = `Happy Birthday, ${titleCase(patient.name)}! 🎂 Thank you for choosing Rivers Dental Clinic. Wishing you a year of healthy smiles!`;

      try {
        await sendMnotify(patient.phone, message);
        console.log(`[sms-birthday] ✅ Sent to ${patient.name} (${patient.phone})`);
        sent++;
      } catch (smsErr) {
        console.error(`[sms-birthday] ❌ Failed for ${patient.name}: ${smsErr.message}`);
        failed++;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(
      `[sms-birthday] Done — sent: ${sent}, skipped: ${skipped}, failed: ${failed}`
    );
    return res.status(200).json({ sent, skipped, failed, trigger: "birthday" });
  } catch (err) {
    console.error("[sms-birthday] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CASE C: Holiday SMS
// ──────────────────────────────────────────────────────────────────────────────
async function handleHoliday(req, res) {
  if (!process.env.MNOTIFY_API_KEY) {
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured" });
  }

  try {
    const supabase = getSupabaseClient();
    const todayMonthDay = getTodayMonthDay();

    // Find matching holiday
    const holiday = GHANA_HOLIDAYS.find((h) => h.date === todayMonthDay);
    if (!holiday) {
      console.log("[sms-holiday] No holiday today");
      return res.status(200).json({ sent: 0, skipped: 0, failed: 0, trigger: "holiday" });
    }

    console.log(`[sms-holiday] Today is ${holiday.name}`);

    // Fetch all patients with phone and NOT opted out of holiday SMS
    const { data: patients, error } = await supabase
      .from("patients")
      .select("name, phone, sms_optout_holiday")
      .neq("phone", null)
      .not("phone", "eq", "")
      .eq("sms_optout_holiday", false);

    if (error) throw error;

    console.log(`[sms-holiday] Sending to ${patients.length} patient(s)`);

    let sent = 0,
      skipped = 0,
      failed = 0;

    for (const patient of patients) {
      try {
        await sendMnotify(patient.phone, holiday.message);
        console.log(`[sms-holiday] ✅ Sent to ${patient.name}`);
        sent++;
      } catch (smsErr) {
        console.error(`[sms-holiday] ❌ Failed for ${patient.name}: ${smsErr.message}`);
        failed++;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(
      `[sms-holiday] Done — sent: ${sent}, skipped: ${skipped}, failed: ${failed}`
    );
    return res.status(200).json({ sent, skipped, failed, trigger: "holiday", holiday: holiday.name });
  } catch (err) {
    console.error("[sms-holiday] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CASE D: Review/Recall SMS
// ──────────────────────────────────────────────────────────────────────────────
async function handleReview(req, res) {
  if (!process.env.MNOTIFY_API_KEY) {
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured" });
  }

  try {
    const supabase = getSupabaseClient();

    // Fetch all medical acts with review_months set
    const { data: acts, error: actsErr } = await supabase
      .from("medical_acts")
      .select("id, name, review_months")
      .not("review_months", "is", null)
      .eq("active", true);

    if (actsErr) throw actsErr;

    console.log(`[sms-review] Found ${acts.length} act(s) with review intervals`);

    const reviewsToSend = [];
    const sentToday = {}; // Track patients already sent review reminders today (per procedure)

    // For each act with a review interval, find patients with latest invoice for that procedure
    for (const act of acts) {
      const { data: invoices, error: invErr } = await supabase
        .from("invoice_items")
        .select("invoice_id, procedure")
        .ilike("procedure", `%${act.name}%`);

      if (invErr) continue; // Skip this act if error

      for (const item of invoices) {
        const { data: invoice, error: invoiceErr } = await supabase
          .from("invoices")
          .select("id, reference_number, date")
          .eq("id", item.invoice_id)
          .single();

        if (invoiceErr) continue;

        const dueDate = calculateDueDate(invoice.date, act.review_months);
        if (!isWithin7Days(dueDate)) continue;

        // Get patient details including opt-out flag
        const { data: patient, error: patientErr } = await supabase
          .from("patients")
          .select("reference_number, name, phone, sms_optout_review")
          .eq("reference_number", invoice.reference_number)
          .single();

        if (patientErr || !patient || !patient.phone || patient.sms_optout_review) continue;

        // Use latest invoice per procedure per patient (dedupe key)
        const dedupeKey = `${patient.reference_number}-${act.name}`;
        if (sentToday[dedupeKey]) continue;
        sentToday[dedupeKey] = true;

        reviewsToSend.push({
          patient,
          procedure: act.name,
          dueDate,
          invoiceId: invoice.id,
        });
      }
    }

    console.log(`[sms-review] Found ${reviewsToSend.length} review reminder(s)`);

    let sent = 0,
      skipped = 0,
      failed = 0;

    for (const review of reviewsToSend) {
      const message =
        `Hello ${titleCase(review.patient.name)}, it's time for your ${review.procedure.toLowerCase()} review! ` +
        `Your last appointment was on ${review.dueDate}. ` +
        `Please call 030 244 8742 to schedule your visit.`;

      try {
        await sendMnotify(review.patient.phone, message);
        console.log(`[sms-review] ✅ Sent to ${review.patient.name}`);
        sent++;
      } catch (smsErr) {
        console.error(`[sms-review] ❌ Failed for ${review.patient.name}: ${smsErr.message}`);
        failed++;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`[sms-review] Done — sent: ${sent}, skipped: ${skipped}, failed: ${failed}`);
    return res.status(200).json({ sent, skipped, failed, trigger: "review" });
  } catch (err) {
    console.error("[sms-review] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
// CASE E: Follow-up SMS (recurring dates: 4-5 times per year, ALL patients)
// ──────────────────────────────────────────────────────────────────────────────
async function handleFollowup(req, res) {
  if (!process.env.MNOTIFY_API_KEY) {
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured" });
  }

  try {
    const supabase = getSupabaseClient();
    const todayMonthDay = getTodayMonthDay();

    // Check if today matches one of the follow-up SMS dates
    if (!FOLLOWUP_SMS_DATES.includes(todayMonthDay)) {
      console.log(`[sms-followup] Today (${todayMonthDay}) is not a follow-up SMS date — skipping`);
      return res.status(200).json({ sent: 0, skipped: 0, failed: 0, trigger: "followup", reason: "not_a_followup_date" });
    }

    console.log(`[sms-followup] Today is a follow-up SMS date (${todayMonthDay})`);

    // Fetch all patients with phone and NOT opted out of followup SMS
    const { data: patients, error } = await supabase
      .from("patients")
      .select("name, phone, sms_optout_followup")
      .neq("phone", null)
      .not("phone", "eq", "")
      .eq("sms_optout_followup", false);

    if (error) throw error;

    console.log(`[sms-followup] Sending to ${patients.length} patient(s)`);

    let sent = 0,
      skipped = 0,
      failed = 0;

    for (const patient of patients) {
      const message =
        `Hello ${titleCase(patient.name)}, thank you for choosing Rivers Dental Clinic! ` +
        `We appreciate your trust in our services. We look forward to seeing you again soon. ` +
        `Call 030 244 8742 to schedule your next visit.`;

      try {
        await sendMnotify(patient.phone, message);
        console.log(`[sms-followup] ✅ Sent to ${patient.name}`);
        sent++;
      } catch (smsErr) {
        console.error(`[sms-followup] ❌ Failed for ${patient.name}: ${smsErr.message}`);
        failed++;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(
      `[sms-followup] Done — sent: ${sent}, skipped: ${skipped}, failed: ${failed}`
    );
    return res.status(200).json({ sent, skipped, failed, trigger: "followup" });
  } catch (err) {
    console.error("[sms-followup] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST: Send all SMS types to a single patient (for testing with real DB)
// ──────────────────────────────────────────────────────────────────────────────
async function handleTestAll(req, res, body) {
  if (!process.env.MNOTIFY_API_KEY) {
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured" });
  }

  const ref = body.reference_number;
  if (!ref) {
    return res.status(400).json({ error: "reference_number is required" });
  }

  try {
    const supabase = getSupabaseClient();

    // Get patient details
    const { data: patient, error: patientErr } = await supabase
      .from("patients")
      .select("name, phone")
      .eq("reference_number", ref)
      .single();

    if (patientErr || !patient || !patient.phone) {
      return res.status(404).json({ error: "Patient not found or has no phone" });
    }

    const results = {};
    let totalSent = 0;

    // Test Birthday SMS
    try {
      const msg = `Happy Birthday, ${titleCase(patient.name)}! Thank you for choosing Rivers Dental Clinic. Wishing you a year of healthy smiles!`;
      await sendMnotify(patient.phone, msg);
      results.birthday = "sent";
      totalSent++;
    } catch (e) {
      results.birthday = `error: ${e.message}`;
    }

    // Test Holiday SMS
    try {
      const holiday = GHANA_HOLIDAYS[0]; // Send first holiday for test
      await sendMnotify(patient.phone, holiday.message);
      results.holiday = "sent";
      totalSent++;
    } catch (e) {
      results.holiday = `error: ${e.message}`;
    }

    // Test Review SMS
    try {
      const testMsg = `Hello ${titleCase(patient.name)}, it's time for your dental review! Please call 030 244 8742 to schedule your visit.`;
      await sendMnotify(patient.phone, testMsg);
      results.review = "sent";
      totalSent++;
    } catch (e) {
      results.review = `error: ${e.message}`;
    }

    // Test Followup SMS
    try {
      const testMsg = `Hello ${titleCase(patient.name)}, thank you for choosing Rivers Dental Clinic! We appreciate your trust in our services. Call 030 244 8742 to schedule your next visit.`;
      await sendMnotify(patient.phone, testMsg);
      results.followup = "sent";
      totalSent++;
    } catch (e) {
      results.followup = `error: ${e.message}`;
    }

    console.log(`[sms-test-all] Sent ${totalSent} test SMS to ${ref}`);
    return res.status(200).json({ ...results, trigger: "test-all", reference_number: ref, totalSent });
  } catch (err) {
    console.error("[sms-test-all] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CASE F: Manual SMS
// ──────────────────────────────────────────────────────────────────────────────
async function handleManual(req, res, body) {
  if (!process.env.MNOTIFY_API_KEY) {
    return res.status(500).json({ error: "MNOTIFY_API_KEY not configured" });
  }

  const { phone, message } = body;
  if (!phone) return res.status(400).json({ error: "phone is required" });
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const response = await fetch("https://api.mnotify.com/api/sms/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: process.env.MNOTIFY_API_KEY,
        recipient: [normalisePhone(phone)],
        message: message,
        sender: process.env.MNOTIFY_SENDER_ID || "RiversDent",
        is_schedule: "false",
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
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Cron and scheduled triggers (birthday, holiday, review, followup) require Bearer token only
  if (body && ["cron", "birthday", "holiday", "review", "followup", "test-all"].includes(body.trigger)) {
    if (!verifyBearerToken(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (body.trigger === "cron") return handleCron(req, res);
    if (body.trigger === "birthday") return handleBirthday(req, res);
    if (body.trigger === "holiday") return handleHoliday(req, res);
    if (body.trigger === "review") return handleReview(req, res);
    if (body.trigger === "followup") return handleFollowup(req, res);
    if (body.trigger === "test-all") return handleTestAll(req, res, body);
  }

  // Manual SMS requires dashboard auth
  if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

  return handleManual(req, res, body);
};
