/**
 * /api/reports.js  (Phase 4): read-only cross-patient invoice ACTIVITY log.
 *
 * GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|paid|unpaid|partial
 *                 &procedure=TEXT&q=TEXT&page=1&limit=25&totals=1
 * GET /api/reports?...same filters...&export=csv   -> CSV of ALL matching log rows
 *
 * One row = ONE invoice_history entry (an invoice being created, or later updated /
 * paid against). invoice_history stores CUMULATIVE amounts per snapshot, so for every
 * row we also compute `payment` = amount_paid - previous snapshot's amount_paid for the
 * same invoice (the receipt for that event).
 *
 * Why everything is filtered in memory: a row's payment depends on the PREVIOUS history
 * row of the same invoice, which may be outside the date range. So we load the full
 * history (paginated), derive payments, THEN apply date/status/procedure filters.
 *
 * invoice_history only has an FK to invoices, so patients are NOT embedded in the
 * history query (that caused PGRST200). Names are looked up separately by reference.
 */
const { authRequest } = require("./_auth");
const { createClient } = require("@supabase/supabase-js");
const { applyCors } = require("./_cors");

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabase;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["all", "paid", "unpaid", "partial"];
const CHUNK = 1000;          // Supabase row cap per request
const MAX_ROWS = 20000;      // safety stop
const MAX_PATIENT_MATCHES = 300;
const EPS = 0.005;

function clean(s) {
  return String(s || "").replace(/[%*,()"\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
const num = v => parseFloat(v) || 0;
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;

function parseFilters(q) {
  return {
    from: DATE_RE.test(q.from || "") ? q.from : "",
    to: DATE_RE.test(q.to || "") ? q.to : "",
    status: STATUSES.includes(q.status) ? q.status : "all",
    procedure: clean(q.procedure),
    q: clean(q.q),
  };
}

async function resolveRefs(supabase, text) {
  if (!text) return { refs: null, truncated: false };
  const { data, error } = await supabase
    .from("patients")
    .select("reference_number")
    .or(`name.ilike.%${text}%,reference_number.ilike.${text}%`)
    .order("reference_number")
    .limit(MAX_PATIENT_MATCHES + 1);
  if (error) throw error;
  const refs = (data || []).map(r => r.reference_number);
  return { refs: refs.slice(0, MAX_PATIENT_MATCHES), truncated: refs.length > MAX_PATIENT_MATCHES };
}

// Every history row, oldest first. Ties broken by id so ordering is stable.
async function fetchAllHistory(supabase) {
  const out = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from("invoice_history")
      .select("id, invoice_id, changed_at, grand_total, amount_paid, amount_remaining, discount_amount, paid, note, snapshot_items")
      .order("changed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + CHUNK - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < CHUNK) break;
    if (out.length >= MAX_ROWS) throw new Error("Too many history rows to load.");
  }
  return out;
}

async function fetchInvoices(supabase, ids) {
  const map = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("invoices").select("id, reference_number, date").in("id", ids.slice(i, i + 100));
    if (error) throw error;
    (data || []).forEach(r => { map[r.id] = r; });
  }
  return map;
}

async function fetchPatientNames(supabase, refs) {
  const map = {};
  for (let i = 0; i < refs.length; i += 100) {
    const { data, error } = await supabase
      .from("patients").select("reference_number, name").in("reference_number", refs.slice(i, i + 100));
    if (error) throw error;
    (data || []).forEach(r => { map[r.reference_number] = r.name; });
  }
  return map;
}

// Fallback for invoices whose history has no snapshot at all.
async function fetchLiveItems(supabase, ids) {
  const map = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("invoice_items").select("invoice_id, procedure, qty, total_price")
      .in("invoice_id", ids.slice(i, i + 100)).order("created_at", { ascending: true });
    if (error) throw error;
    (data || []).forEach(it => { (map[it.invoice_id] = map[it.invoice_id] || []).push(it); });
  }
  return map;
}

const shapeItems = list => (list || []).map(i => ({
  procedure: i.procedure, qty: num(i.qty) || 1, total_price: num(i.total_price),
}));

// Build the full, enriched event list (oldest -> newest), before filtering.
async function buildEvents(supabase) {
  const history = await fetchAllHistory(supabase);
  const invMap = await fetchInvoices(supabase, [...new Set(history.map(h => h.invoice_id))]);
  const nameMap = await fetchPatientNames(supabase, [...new Set(Object.values(invMap).map(i => i.reference_number))]);

  const prevPaid = {};   // invoice_id -> last cumulative amount_paid
  const prevItems = {};  // invoice_id -> last known items snapshot
  const needLive = new Set();
  const events = [];

  history.forEach(h => {
    const inv = invMap[h.invoice_id];
    if (!inv) return;                               // invoice deleted
    const isFirst = !(h.invoice_id in prevPaid);
    const paidNow = num(h.amount_paid);
    const payment = round2(paidNow - (prevPaid[h.invoice_id] || 0));
    prevPaid[h.invoice_id] = paidNow;

    let items = Array.isArray(h.snapshot_items) && h.snapshot_items.length ? h.snapshot_items : null;
    if (items) prevItems[h.invoice_id] = items; else items = prevItems[h.invoice_id] || null;
    if (!items) needLive.add(h.invoice_id);

    events.push({
      id: h.id,
      invoice_id: h.invoice_id,
      changed_at: h.changed_at,
      reference_number: inv.reference_number,
      name: nameMap[inv.reference_number] || "",
      event: isFirst ? "created" : "updated",
      note: h.note || "",
      items,
      grand_total: num(h.grand_total),
      discount_amount: num(h.discount_amount),
      amount_paid: paidNow,
      amount_remaining: num(h.amount_remaining),
      payment,
      status: h.paid ? "paid" : (paidNow > EPS ? "partial" : "unpaid"),
    });
  });

  if (needLive.size) {
    const live = await fetchLiveItems(supabase, [...needLive]);
    events.forEach(e => { if (!e.items) e.items = live[e.invoice_id] || []; });
  }
  events.forEach(e => { e.items = shapeItems(e.items); });
  return events;
}

function applyFilters(events, f, refs) {
  const refSet = refs ? new Set(refs) : null;
  const pf = f.procedure.toLowerCase();
  return events.filter(e => {
    const day = String(e.changed_at).slice(0, 10);       // Ghana = UTC+0
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.status !== "all" && e.status !== f.status) return false;
    if (refSet && !refSet.has(e.reference_number)) return false;
    if (pf && !e.items.some(i => String(i.procedure || "").toLowerCase().includes(pf))) return false;
    return true;
  });
}

function computeTotals(rows, f) {
  const t = { count: rows.length, billed: 0, collected: 0, outstanding: 0 };
  const latest = {};
  rows.forEach(r => {
    if (r.event === "created") t.billed += r.grand_total;   // new invoices raised in range
    t.collected += r.payment;                                // money received in range
    latest[r.invoice_id] = r;                                // rows are oldest -> newest
  });
  Object.values(latest).forEach(r => { t.outstanding += r.amount_remaining; });
  t.billed = round2(t.billed); t.collected = round2(t.collected); t.outstanding = round2(t.outstanding);
  if (f.procedure) {
    const pf = f.procedure.toLowerCase();
    const p = { lines: 0, qty: 0, subtotal: 0 };
    rows.filter(r => r.event === "created").forEach(r => r.items.forEach(i => {
      if (String(i.procedure || "").toLowerCase().includes(pf)) { p.lines++; p.qty += i.qty; p.subtotal += i.total_price; }
    }));
    p.subtotal = round2(p.subtotal);
    t.procedure = p;
  }
  return t;
}

function csvCell(v) {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const label = s => (s === "paid" ? "Paid" : s === "partial" ? "Partly paid" : "Unpaid");
const CSV_HEAD = "Date,Time,Reference,Patient,Event,Procedures,Invoice Total,Discount,Payment This Entry,Paid To Date,Remaining,Status,Note";

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const supabase = getSupabase();
    const f = parseFilters(req.query || {});
    const { refs, truncated } = await resolveRefs(supabase, f.q);
    const warning = truncated ? `Patient search matched more than ${MAX_PATIENT_MATCHES} people; only the first ${MAX_PATIENT_MATCHES} are included. Type more of the name.` : undefined;
    const isCsv = req.query.export === "csv";

    if (refs && refs.length === 0) {
      if (isCsv) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.status(200).send(CSV_HEAD + "\n");
      }
      return res.status(200).json({ rows: [], total: 0, page: 1, limit: 25, totals: { count: 0, billed: 0, collected: 0, outstanding: 0 } });
    }

    const events = await buildEvents(supabase);
    const matched = applyFilters(events, f, refs);          // oldest -> newest
    const newestFirst = matched.slice().reverse();

    if (isCsv) {
      const lines = [CSV_HEAD];
      matched.forEach(r => {
        const procs = r.items.map(i => (i.qty > 1 ? `${i.procedure} x${i.qty}` : i.procedure)).join("; ");
        lines.push([
          String(r.changed_at).slice(0, 10), String(r.changed_at).slice(11, 16), r.reference_number, r.name,
          r.event === "created" ? "Invoice created" : "Invoice updated", procs,
          r.grand_total.toFixed(2), r.discount_amount.toFixed(2), r.payment.toFixed(2),
          r.amount_paid.toFixed(2), r.amount_remaining.toFixed(2), label(r.status), r.note,
        ].map(csvCell).join(","));
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="rivers-invoice-activity.csv"');
      return res.status(200).send(lines.join("\n") + "\n");
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 5), 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const slice = newestFirst.slice((page - 1) * limit, page * limit);

    const out = {
      rows: slice.map(r => ({
        id: r.id,
        invoice_id: r.invoice_id,
        date: r.changed_at,
        reference_number: r.reference_number,
        name: r.name,
        event: r.event,
        note: r.note,
        items: r.items,
        grand_total: r.grand_total,
        discount_amount: r.discount_amount,
        payment: r.payment,
        amount_paid: r.amount_paid,
        amount_remaining: r.amount_remaining,
        status: r.status,
      })),
      total: matched.length,
      page, limit,
    };
    if (req.query.totals === "1") out.totals = computeTotals(matched, f);
    if (warning) out.warning = warning;
    return res.status(200).json(out);
  } catch (e) {
    console.error("reports error:", e);
    return res.status(500).json({ error: e.message || "Could not load report" });
  }
};