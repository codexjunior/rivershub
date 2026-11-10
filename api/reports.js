/**
 * /api/reports.js  (Phase 4): read-only cross-patient invoice log.
 *
 * GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|paid|unpaid|partial
 *                 &procedure=TEXT&q=TEXT&page=1&limit=25&totals=1
 * GET /api/reports?...same filters...&export=csv        -> CSV of EVERY matching invoice
 *
 * Auth: Authorization: Bearer TOKEN:PASSWORD (same as every other endpoint).
 *
 * - No schema change. Reads `invoices`, `invoice_items`, `patients`.
 * - `totals=1` also returns billed / collected / outstanding over the WHOLE filtered set
 *   (not just the page). Totals are read page by page (Supabase silently caps one
 *   request at 1000 rows, see F12).
 * - `procedure` matches invoice_items.procedure (case-insensitive, contains). The page
 *   still returns ALL items of each matching invoice; totals.procedure holds the
 *   subtotal of the matching lines only.
 * - `q` matches patient name (contains) or reference / phone-free reference prefix.
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
const MAX_ROWS = 20000;      // safety stop for totals / export
const MAX_PATIENT_MATCHES = 300;

// Remove characters that have meaning inside PostgREST filter strings.
function clean(s) {
  return String(s || "").replace(/[%*,()"\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
const num = v => parseFloat(v) || 0;
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;

function parseFilters(q) {
  const f = {
    from: DATE_RE.test(q.from || "") ? q.from : "",
    to: DATE_RE.test(q.to || "") ? q.to : "",
    status: STATUSES.includes(q.status) ? q.status : "all",
    procedure: clean(q.procedure),
    q: clean(q.q),
  };
  return f;
}

// Resolve the patient search into a list of reference numbers (or null = no patient filter).
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
  const truncated = refs.length > MAX_PATIENT_MATCHES;
  return { refs: refs.slice(0, MAX_PATIENT_MATCHES), truncated };
}

// Apply the shared filters to a query. `p` = column prefix ("" for invoices,
// "invoices." when the query is on invoice_items with an inner-joined invoices embed).
function applyFilters(query, f, refs, p) {
  if (f.from) query = query.gte(`${p}date`, f.from);
  if (f.to) query = query.lte(`${p}date`, f.to);
  if (f.status === "paid") query = query.eq(`${p}paid`, true);
  if (f.status === "unpaid") query = query.eq(`${p}paid`, false).lte(`${p}amount_paid`, 0);
  if (f.status === "partial") query = query.eq(`${p}paid`, false).gt(`${p}amount_paid`, 0);
  if (refs) query = query.in(`${p}reference_number`, refs);
  return query;
}

const INV_COLS =
  "id, reference_number, date, discount_amount, subtotal, grand_total, amount_paid, amount_remaining, paid, patients(name)";

function invoiceQuery(supabase, f, refs, cols, opts) {
  const embed = f.procedure ? `${cols}, invoice_items!inner(id)` : cols;
  let q = supabase.from("invoices").select(embed, opts);
  q = applyFilters(q, f, refs, "");
  if (f.procedure) q = q.ilike("invoice_items.procedure", `%${f.procedure}%`);
  return q;
}

async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await build().range(from, from + CHUNK - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < CHUNK) break;
    if (out.length >= MAX_ROWS) throw new Error("Too many rows. Narrow the date range.");
  }
  return out;
}

async function fetchItems(supabase, ids) {
  const byInvoice = {};
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from("invoice_items")
      .select("invoice_id, procedure, qty, unit_price, total_price")
      .in("invoice_id", slice)
      .order("created_at", { ascending: true });
    if (error) throw error;
    (data || []).forEach(it => { (byInvoice[it.invoice_id] = byInvoice[it.invoice_id] || []).push(it); });
  }
  return byInvoice;
}

function statusOf(inv) {
  if (inv.paid) return "paid";
  return num(inv.amount_paid) > 0.005 ? "partial" : "unpaid";
}

function shapeRow(inv, items) {
  return {
    id: inv.id,
    date: inv.date,
    reference_number: inv.reference_number,
    name: (inv.patients && inv.patients.name) || "",
    items: (items || []).map(i => ({ procedure: i.procedure, qty: num(i.qty), total_price: num(i.total_price) })),
    subtotal: num(inv.subtotal),
    discount_amount: num(inv.discount_amount),
    grand_total: num(inv.grand_total),
    amount_paid: num(inv.amount_paid),
    amount_remaining: num(inv.amount_remaining),
    status: statusOf(inv),
  };
}

function csvCell(v) {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const supabase = getSupabase();
    const f = parseFilters(req.query || {});
    const { refs, truncated } = await resolveRefs(supabase, f.q);
    const warning = truncated ? `Patient search matched more than ${MAX_PATIENT_MATCHES} people; only the first ${MAX_PATIENT_MATCHES} are included. Type more of the name.` : undefined;

    // No patient matched: empty result, skip the invoice queries.
    if (refs && refs.length === 0) {
      if (req.query.export === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.status(200).send("Date,Reference,Patient,Procedures,Subtotal,Discount,Total,Paid,Remaining,Status\n");
      }
      return res.status(200).json({
        rows: [], total: 0, page: 1, limit: 25,
        totals: { count: 0, billed: 0, collected: 0, outstanding: 0 },
      });
    }

    // ── CSV export of every matching invoice ──
    if (req.query.export === "csv") {
      const invoices = await fetchAll(() =>
        invoiceQuery(supabase, f, refs, INV_COLS).order("date", { ascending: false }).order("id"));
      const items = await fetchItems(supabase, invoices.map(i => i.id));
      const lines = ["Date,Reference,Patient,Procedures,Subtotal,Discount,Total,Paid,Remaining,Status"];
      invoices.forEach(inv => {
        const r = shapeRow(inv, items[inv.id]);
        const procs = r.items.map(i => (i.qty > 1 ? `${i.procedure} x${i.qty}` : i.procedure)).join("; ");
        lines.push([r.date, r.reference_number, r.name, procs, r.subtotal.toFixed(2), r.discount_amount.toFixed(2),
          r.grand_total.toFixed(2), r.amount_paid.toFixed(2), r.amount_remaining.toFixed(2), r.status].map(csvCell).join(","));
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="rivers-invoices.csv"');
      return res.status(200).send(lines.join("\n") + "\n");
    }

    // ── One page of rows ──
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 5), 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const { data: invoices, count, error } = await invoiceQuery(supabase, f, refs, INV_COLS, { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const items = await fetchItems(supabase, (invoices || []).map(i => i.id));
    const out = { rows: (invoices || []).map(inv => shapeRow(inv, items[inv.id])), total: count || 0, page, limit };
    if (warning) out.warning = warning;

    // ── Totals over the whole filtered set (only when asked) ──
    if (req.query.totals === "1") {
      const all = await fetchAll(() =>
        invoiceQuery(supabase, f, refs, "id, grand_total, amount_paid, amount_remaining").order("id"));
      const totals = { count: all.length, billed: 0, collected: 0, outstanding: 0 };
      all.forEach(i => {
        totals.billed += num(i.grand_total);
        totals.collected += num(i.amount_paid);
        totals.outstanding += num(i.amount_remaining);
      });
      totals.billed = round2(totals.billed);
      totals.collected = round2(totals.collected);
      totals.outstanding = round2(totals.outstanding);

      if (f.procedure) {
        // Subtotal of just the matching lines inside the filtered invoices.
        const lines = await fetchAll(() => {
          let q = supabase.from("invoice_items").select("total_price, qty, invoices!inner(id)")
            .ilike("procedure", `%${f.procedure}%`);
          q = applyFilters(q, f, refs, "invoices.");
          return q.order("id");
        });
        totals.procedure = {
          lines: lines.length,
          qty: round2(lines.reduce((s, l) => s + num(l.qty), 0)),
          subtotal: round2(lines.reduce((s, l) => s + num(l.total_price), 0)),
        };
      }
      out.totals = totals;
    }

    return res.status(200).json(out);
  } catch (e) {
    console.error("reports error:", e);
    return res.status(500).json({ error: e.message || "Could not load report" });
  }
};