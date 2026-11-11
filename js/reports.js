// ═══════════════════════════════════════════════════════════════
//  REPORTS (Phase 4): read-only invoice log across all patients
//  Data: GET /api/reports (see api/reports.js). Loaded before main.js.
// ═══════════════════════════════════════════════════════════════
const REP_LIMIT = 25;
let repPage = 1, repReq = 0, repOpened = false, repTimer = null;
let repLastProc = "";          // procedure filter used by the rows on screen (for highlighting)

const repEl = id => document.getElementById(id);
const repMoney = v => Number(v || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const repDate = s => s
  ? new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
  : "-";
const REP_STATUS = { paid: "Paid", partial: "Partly paid", unpaid: "Unpaid" };

// ── Filters ─────────────────────────────────────────────────────
function repFilters() {
  return {
    from: repEl("repFrom").value,
    to: repEl("repTo").value,
    status: repEl("repStatus").value,
    procedure: repEl("repProc").value.trim(),
    q: repEl("repQ").value.trim(),
  };
}

function repParams(extra) {
  const p = new URLSearchParams();
  Object.entries(repFilters()).forEach(([k, v]) => { if (v && !(k === "status" && v === "all")) p.set(k, v); });
  Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
  return p;
}

// Period presets use the Accra calendar (UTC+0, same as the rest of the app)
function repApplyPreset(kind) {
  const today = getAccraToday();
  const [y, m] = today.split("-").map(Number);
  const iso = d => d.toISOString().slice(0, 10);
  let from = "", to = "";
  if (kind === "month") { from = iso(new Date(Date.UTC(y, m - 1, 1))); to = iso(new Date(Date.UTC(y, m, 0))); }
  else if (kind === "lastmonth") { from = iso(new Date(Date.UTC(y, m - 2, 1))); to = iso(new Date(Date.UTC(y, m - 1, 0))); }
  else if (kind === "year") { from = `${y}-01-01`; to = `${y}-12-31`; }
  if (kind !== "custom") { repEl("repFrom").value = from; repEl("repTo").value = to; }
  repEl("repPreset").value = kind;
}

function repFillProcedures() {
  repEl("repProcList").innerHTML = (typeof ACTS !== "undefined" ? ACTS : [])
    .map(n => `<option value="${escAttr(n)}"></option>`).join("");
}

// ── Load + render ───────────────────────────────────────────────
async function loadReport(page = 1, withTotals = true) {
  const id = ++repReq;
  repPage = page;
  const box = repEl("repContent");
  if (!box.innerHTML.trim()) box.innerHTML = `<div class="state-msg"><p>Loading report…</p></div>`;
  else box.classList.add("is-loading");
  const proc = repFilters().procedure;
  try {
    const params = repParams({ page, limit: REP_LIMIT });
    if (withTotals) params.set("totals", "1");
    const res = await fetch(`${API_BASE}/api/reports?${params}`, { headers: authHeader() });
    const data = await res.json().catch(() => ({}));
    if (id !== repReq) return;                       // a newer request replaced this one
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    repLastProc = proc;
    if (data.totals) repRenderTotals(data.totals);
    repRenderSummary(data);
    repRenderRows(data.rows || []);
    repRenderPager(data);
    sortRepRows();          // FIX: re-sort rendered rows by date (newest first)
    box.classList.remove("is-loading");
  } catch (e) {
    if (id !== repReq) return;
    box.classList.remove("is-loading");
    box.innerHTML = `<div class="state-msg"><p>Could not load the report.<br><small>${escHtml(e.message)}</small></p>
      <p><button class="btn-ghost" id="repRetry" type="button">Try again</button></p></div>`;
    repEl("repSummary").innerHTML = "";
    repEl("repPagination").innerHTML = "";
  }
}

function repRenderTotals(t) {
  repEl("repBilled").textContent = repMoney(t.billed);
  repEl("repCollected").textContent = repMoney(t.collected);
  repEl("repOutstanding").textContent = repMoney(t.outstanding);
}

function repRenderSummary(data) {
  const n = data.total || 0;
  let html = `<span><strong>${n}</strong> invoice${n === 1 ? "" : "s"}</span>`;
  const p = data.totals && data.totals.procedure;
  if (p) {
    html += `<span class="rep-proc">${escHtml(repFilters().procedure.toUpperCase())}: ${p.lines} line${p.lines === 1 ? "" : "s"}, qty ${p.qty}, <strong>GHS ${repMoney(p.subtotal)}</strong> (matching lines only)</span>`;
  }
  if (data.warning) html += `<span class="rep-warn">${escHtml(data.warning)}</span>`;
  repEl("repSummary").innerHTML = html;
}

function repRenderRows(rows) {
  const box = repEl("repContent");
  if (rows.length === 0) {
    box.innerHTML = `<div class="state-msg"><p>No invoices match these filters.</p></div>`;
    return;
  }
  const pf = repLastProc.toLowerCase();
  let html = `<div class="rep-card"><table class="rep-table"><thead><tr>
    <th>Date</th><th>Patient</th><th>Procedures</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Remaining</th><th>Status</th>
  </tr></thead><tbody>`;
  rows.forEach(r => {
    const items = (r.items || []).length
      ? `<ul class="rep-items">${r.items.map(i => {
          const hit = pf && String(i.procedure || "").toLowerCase().includes(pf);
          return `<li${hit ? ' class="rep-hit"' : ""}>${escHtml(i.procedure)}${i.qty > 1 ? ` <span class="rep-qty">×${i.qty}</span>` : ""}</li>`;
        }).join("")}</ul>`
      : "-";
    const due = r.amount_remaining > 0.005;
    html += `<tr class="rep-row" data-ref="${escAttr(r.reference_number)}" tabindex="0" title="Open patient">
      <td data-label="Date">${escHtml(repDate(r.date))}</td>
      <td data-label="Patient"><span class="rep-name">${escHtml(r.name || "No name")}</span><span class="rep-ref">${escHtml(r.reference_number)}</span></td>
      <td data-label="Procedures">${items}</td>
      <td class="num" data-label="Total">${repMoney(r.grand_total)}</td>
      <td class="num" data-label="Paid">${repMoney(r.amount_paid)}</td>
      <td class="num ${due ? "rep-due" : "rep-ok"}" data-label="Remaining">${repMoney(r.amount_remaining)}</td>
      <td data-label="Status"><span class="paid-badge ${escAttr(r.status)}">${escHtml(REP_STATUS[r.status] || r.status)}</span></td>
    </tr>`;
  });
  box.innerHTML = html + `</tbody></table></div>`;
}

function repRenderPager(data) {
  const total = Math.ceil((data.total || 0) / (data.limit || REP_LIMIT));
  const cur = data.page || 1;
  const el = repEl("repPagination");
  if (total <= 1) { el.innerHTML = ""; return; }
  let h = `<button class="page-btn" data-rep-page="${cur - 1}" ${cur === 1 ? "disabled" : ""}>← Prev</button>`;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - cur) <= 1) h += `<button class="page-btn${i === cur ? " active" : ""}" data-rep-page="${i}">${i}</button>`;
    else if (Math.abs(i - cur) === 2) h += `<span class="page-ellipsis">…</span>`;
  }
  h += `<button class="page-btn" data-rep-page="${cur + 1}" ${cur === total ? "disabled" : ""}>Next →</button>`;
  el.innerHTML = h;
}

// ── CSV export (every matching invoice, not just this page) ─────
async function repExport() {
  const btn = repEl("repExport");
  btn.disabled = true; btn.textContent = "Preparing…";
  try {
    const res = await fetch(`${API_BASE}/api/reports?${repParams({ export: "csv" })}`, { headers: authHeader() });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Export failed"); }
    const text = await res.text();
    const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));   // BOM: Excel reads UTF-8
    const a = document.createElement("a");
    a.href = url; a.download = `rivers-invoices-${getAccraToday()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("CSV downloaded");
  } catch (e) { showToast(e.message || "Export failed", true); }
  finally { btn.disabled = false; btn.textContent = "Export CSV"; }
}

// ── Click-through: invoice row → that patient's page ────────────
function repOpenPatient(ref) {
  showPage("patients");
  if (allPatients.length === 0) loadPatients();
  viewPatient(ref);
}

// ── FIX: after each report load, re-sort repContent rows by date (newest first)
function sortRepRows() {
  const container = repEl("repContent");
  if (!container || !container.querySelector(".rep-row")) return;
  const rows = Array.from(container.querySelectorAll(".rep-row"));
  rows.sort((a, b) => {
    const da = new Date(a.cells[0]?.textContent || "").getTime();
    const db = new Date(b.cells[0]?.textContent || "").getTime();
    return db - da; // newest first
  });
  // re-append sorted rows into tbody
  const tbody = container.querySelector("tbody");
  if (tbody) {
    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
  }
}

// ── Wiring ──────────────────────────────────────────────────────
function repReload() { clearTimeout(repTimer); loadReport(1, true); }
function repReloadSoon() { clearTimeout(repTimer); repTimer = setTimeout(() => loadReport(1, true), 400); }

repEl("repPreset").addEventListener("change", e => { repApplyPreset(e.target.value); repReload(); });
["repFrom", "repTo"].forEach(id => repEl(id).addEventListener("change", () => { repEl("repPreset").value = "custom"; repReload(); }));
repEl("repStatus").addEventListener("change", repReload);
["repProc", "repQ"].forEach(id => repEl(id).addEventListener("input", repReloadSoon));
repEl("repReset").addEventListener("click", () => {
  repEl("repStatus").value = "all"; repEl("repProc").value = ""; repEl("repQ").value = "";
  repApplyPreset("month"); repReload();
});
repEl("repExport").addEventListener("click", repExport);

repEl("repPagination").addEventListener("click", e => {
  const b = e.target.closest("[data-rep-page]");
  if (b && !b.disabled) { loadReport(parseInt(b.dataset.repPage, 10), false); window.scrollTo({ top: 0 }); }
});
repEl("repContent").addEventListener("click", e => {
  if (e.target.closest("#repRetry")) return loadReport(repPage, true);
  const row = e.target.closest(".rep-row");
  if (row) repOpenPatient(row.dataset.ref);
});
repEl("repContent").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const row = e.target.closest(".rep-row");
  if (row) repOpenPatient(row.dataset.ref);
});

// Opening the page: defaults to ALL time; always refreshes (an invoice may have just been saved)
document.querySelectorAll('[data-page="reports"]').forEach(btn => btn.addEventListener("click", () => {
  repFillProcedures();
  if (!repOpened) { repOpened = true; repApplyPreset("all"); }
  loadReport(1, true);
}));