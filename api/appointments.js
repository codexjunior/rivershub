const { authRequest } = require("./_auth");
/**
 * /api/appointments.js
 * Returns all upcoming appointments from Google Calendar.
 */

const { google } = require("googleapis");

const CACHE_TTL = 5 * 1000;
let _cache = null, _cacheTime = 0;
module.exports.invalidateCache = () => { _cache = null; _cacheTime = 0; };

const TIMEZONE = "Africa/Accra";

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
}



function parseDescription(description) {
  if (!description) return { structured: null, notes: "" };

  const get = (key) => {
    const match = description.match(new RegExp(`^${key}: (.+)`, "m"));
    return match ? match[1].trim() : null;
  };

  const patient = get("Patient");
  const service = get("Service");
  const email   = get("Email");
  const phone   = get("Phone");

  // Extract notes — everything after the structured lines
  const structuredKeys = ["Patient", "Service", "Email", "Phone", "Booked via"];
  const lines = description.split("\n");
  const noteLines = lines.filter(l => !structuredKeys.some(k => l.startsWith(k + ":")));
  const rawNotes = noteLines.join("\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ \n/g, "\n")
    .replace(/\n /g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

  // Treat as structured if at least patient exists
  if (patient) {
    return {
      structured: {
        patient,
        service: service || null,
        email:   email   || null,
        phone:   phone   || null,
      },
      notes: rawNotes,
    };
  }

  // Fully manual — no structured fields
  return { structured: null, notes: rawNotes };
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
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });
  
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return res.status(200).json({ appointments: _cache, total: _cache.length });
  }
  try {
    const auth     = getAuthClient();
    const calendar = google.calendar({ version: "v3", auth });
    const now      = new Date().toISOString();
    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: now,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 150,
    });

    const events = (response.data.items || []).map((event) => {
      const start = new Date(event.start.dateTime || event.start.date);
      const end   = new Date(event.end.dateTime   || event.end.date);
      const { structured, notes } = parseDescription(event.description);

      return {
        id:    event.id,
        title: event.summary || "Untitled Appointment",
        isWebBooking: !!(structured?.service), // only website bookings have Service field
        patient: structured?.patient || null,
        service: structured?.service || null,
        email:   structured?.email   || null,
        phone:   structured?.phone   || null,
        notes,
        date: start.toLocaleDateString("en-GH", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          timeZone: TIMEZONE,
        }),
        time: start.toLocaleTimeString("en-GH", {
          hour: "2-digit", minute: "2-digit", hour12: true,
          timeZone: TIMEZONE,
        }),
        timeEnd: end.toLocaleTimeString("en-GH", {
          hour: "2-digit", minute: "2-digit", hour12: true,
          timeZone: TIMEZONE,
        }),
        dateRaw: start.toISOString(),
      };
    });

    _cache = events; _cacheTime = Date.now();
    return res.status(200).json({ appointments: events, total: events.length });

  } catch (err) {
    console.error("[appointments] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch appointments." });
  }
};
