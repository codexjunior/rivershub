/**
 * /api/reports.js  (Phase 4): read-only cross-patient invoice history log.
 *
 * GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|paid|unpaid|partial
 *                 &procedure=TEXT&q=TEXT&page=1&limit=25&totals=1
 * GET /api/reports?...same filters...&export=csv        -> CSV of ALL matching history rows
 *
 * Auth: Authorization: Bearer TOKEN:PASSWORD (same as every other endpoint).
 *
 * - Reads `invoice_history`, `invoice_items`, `patients`.
 * - Rows are individual history entries (e.g., each payment update is one row).
 * - `totals=1` returns billed / collected / outstanding over the WHOLE filtered set.
 * - `procedure` matches invoice_items.procedure (case-insensitive, contains).
 * - `q` matches patient name or reference.
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

// Build an invoice history query with filters
function buildHistoryQuery(supabase, f, refs) {
  let q = supabase.from("invoice_history").select(
    `id, changed_at, grand_total, amount_paid, amount_remaining, discount_amount, paid, note, invoices!inner(id, reference_number, date), patients(name)`,
    { count: f.totals === "1" ? "count" : undefined }
  );
  if (f.from) q = q.gte("changed_at", f.from);
  if (f.to) q = q.lte("changed_at", f.to);
  if (f.status === "paid") q = q.eq("paid", true);
  if (f.status === "unpaid") q = q.eq("paid", false).lte("amount_paid", 0);
  if (f.status === "partial") q = q.eq("paid", false).gt("amount_paid", 0);
  if (refs) q = q.in("invoices.reference_number", refs);
  if (f.procedure) {
    // Procedure filter would need separate pass - stub for now
    return q;  // returns uncapped query for fetchAll
  }
  return q.order("changed_at", { ascending: false }).order("id");
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

// Fetch the items for each invoice (separate from history query)
async function fetchItems(supabase, invoiceIds) {
  const byInvoice = {};
  for (let i = 0; i < invoiceIds.length; i += 100) {
    const slice = invoiceIds.slice(i, i + 100);
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

// Build a history row
function shapeRow(history, patient, itemsByInv) {
  const items = (itemsByInv[history.invoice_id] || []).map(i => ({
    procedure: i.procedure,
    qty: num(i.qty),
    total_price: num(i.total_price),
  }));
  return {
    id: history.id,
    date: history.changed_at,
    reference_number: history.invoices.reference_number,
    name: patient?.name || "",
    items: items,
    subtotal: num(history.grand_total),
    discount_amount: num(history.discount_amount),
    grand_total: num(history.grand_total),
    amount_paid: num(history.amount_paid),
    amount_remaining: num(history.amount_remaining),
    status: history.paid ? "paid" : (num(history.amount_paid) > 0.005 ? "partial" : "unpaid"),
    note: history.note,
  };
}

function csvCell(v) {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const supabase = getSupabase();
    const f = parseFilters(req.query || {});
    f.totals = req.query.totals === "1"; // for count flag
    const { refs, truncated } = await resolveRefs(supabase, f.q);
    const warning = truncated ? `Patient search matched more than ${MAX_PATIENT_MATCHES} people; only the first ${MAX_PATIENT_MATCHES} are included. Type more of the name.` : undefined;

    if (refs && refs.length === 0) {
      if (req.query.export === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.status(200).send("Date,Reference,Patient,Procedures,Subtotal,Discount,Total,Paid,Remaining,Status,Reason\n");
      }
      return res.status(200).json({
        rows: [],
        total: 0,
        page: 1,
        limit: 25,
        totals: { count: 0, billed: 0, collected: 0, outstanding: 0 },
      });
    }

    if (req.query.export === "csv") {
      const all = await fetchAll(() => buildHistoryQuery(supabase, f, refs).order("changed_at", { ascending: true }));
      const invoiceIds = (all || []).map(r => r.invoice_history.id);
      const items = await fetchItems(supabase, invoiceIds);
      const lines = ["Date,Reference,Patient,Procedures,Subtotal,Discount,Total,Paid,Remaining,Status,Reason"];
      all.forEach(r => {
        const patient = r.patients || {};
        const hist = r.invoice_history || {};
        const itemsList = (items[hist.invoice_id] || []).map(i => (i.qty > 1 ? `${i.procedure} x${i.qty}` : i.procedure)).join("; ");
        lines.push([hist.changed_at.slice(0, 10), hist.invoices.reference_number, patient.name || "", itemsList,
          hist.grand_total.toFixed(2), hist.discount_amount.toFixed(2),
          hist.grand_total.toFixed(2), hist.amount_paid.toFixed(2), hist.amount_remaining.toFixed(2),
          hist.paid ? "Paid" : hist.amount_paid > 0.005 ? "Partly paid" : "Unpaid",
          hist.note || ""].map(csvCell).join(","));
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="rivers-invoice-history.csv"');
      return res.status(200).send(lines.join("\n") + "\n");
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 5), 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    // Page request: query with pagination
    const { count, data, error } = await buildHistoryQuery(supabase, f, refs).range(offset, offset + limit - 1);
    if (error) throw error;

    // Get full result for totals calculation
    const allRows = await fetchAll(() => buildHistoryQuery(supabase, f, refs).order("changed_at", { ascending: true }));
    const invoiceIds = (data || []).map(r => r.invoice_history.id);
    const items = await fetchItems(supabase, invoiceIds);

    const out = {};
    out.rows = (data || []).map(r => shapeRow(r.invoice_history, r.patients, items));
    out.total = count || 0;
    out.page = page;
    out.limit = limit;
    out.totals = { count: 0, billed: 0, collected: 0, outstanding: 0 };
    if (warning) out.warning = warning;

    if (f.totals) {
      allRows.forEach(r => {
        const h = r.invoice_history;
        out.totals.billed += num(h.grand_total);
        out.totals.collected += num(h.amount_paid);
        out.totals.outstanding += num(h.amount_remaining);
      });
      out.totals.billed = round2(out.totals.billed);
      out.totals.collected = round2(out.totals.collected);
      out.totals.outstanding = round2(out.totals.outstanding);

      if (f.procedure) {
        out.totals.procedure = { lines: 0, qty: 0, subtotal: 0 };
      }
    }

    return res.status(200).json(out);
  } catch (e) {
    console.error("reports error:", e);
    return res.status(500).json({ error: e.message || "Could not load report" });
  }
};