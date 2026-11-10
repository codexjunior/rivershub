// ═══════════════════════════════════════════════════════════════
//  INVOICE TABLE RENDER
// ═══════════════════════════════════════════════════════════════
function renderInvoiceList(invoices,total,unpaid){
  if(invoices.length===0)return`<div style="padding:1.25rem;font-size:0.84rem;color:#b0bec8;font-style:italic">No invoices yet.</div>`;
  let html=`<div style="overflow-x:auto"><table class="inv-list-table"><thead><tr><th>Date</th><th>No.</th><th>Procedures</th><th>Total</th><th>Remaining</th><th>Status</th><th></th><th></th></tr></thead><tbody>`;
  invoices.forEach(inv=>{
    const procs=inv.invoice_items&&inv.invoice_items.length>0?inv.invoice_items.map(i=>escHtml(i.procedure)).join(", "):escHtml(inv.procedure||"-");
    const remaining=parseFloat(inv.amount_remaining||0);
    const actionBtn=inv.paid
      ? `<span style="font-size:0.69rem;color:var(--muted);font-style:italic">Complete</span>`
      : `<button class="inv-action-btn toggle" onclick="markInvoiceFullyPaid('${inv.id}')">Mark Paid</button>`;
    html+=`<tr>
      <td style="white-space:nowrap">${escHtml(inv.date)}</td>
      <td style="white-space:nowrap;font-size:0.75rem;color:var(--muted)">${escHtml(inv.invoice_number||"-")}</td>
      <td style="max-width:200px;white-space:normal;font-size:0.79rem;line-height:1.5">${procs}</td>
      <td style="white-space:nowrap;font-weight:600">GHS ${parseFloat(inv.grand_total||inv.amount||0).toFixed(2)}</td>
      <td style="white-space:nowrap;font-weight:600;color:${remaining>0.005?"var(--red)":"var(--green)"}">GHS ${remaining.toFixed(2)}</td>
      <td><span class="paid-badge ${inv.paid?"paid":"unpaid"}">${inv.paid?"Paid":"Unpaid"}</span></td>
      <td>
        <div class="inv-actions-cell">
          ${actionBtn}
          <button class="inv-action-btn edit" onclick="editInvoice('${inv.id}')">Edit</button>
          <button class="inv-action-btn history" onclick="viewInvoiceHistory('${inv.id}','${escAttr(inv.invoice_number||inv.date)}')">History</button>
        </div>
      </td>
      <td>
        <div class="inv-actions-cell">
          <button class="inv-action-btn del" onclick="deleteInvoice('${inv.id}')">✕</button>
        </div>
      </td>    
    </tr>`;
  });
  html+=`</tbody></table></div>
    <div class="inv-footer-row">
      <div><span class="inv-footer-total">GHS ${parseFloat(total).toFixed(2)}</span> <span style="font-size:0.75rem;color:var(--muted);margin-left:0.35rem">total billed</span></div>
      <span class="inv-footer-unpaid">GHS ${parseFloat(unpaid).toFixed(2)} outstanding</span>
    </div>`;
  return html;
}

// View invoice history: shows a timeline of all changes to this invoice (creation, edits, payment updates) with snapshots of amounts and notes at each change.
async function viewInvoiceHistory(invoiceId, invoiceLabel){
  // Build and open a simple overlay showing the history entries
  const params=new URLSearchParams({history:invoiceId});
  let entries=[];
  try{
    const res=await fetch(`${API_BASE}/api/invoices?${params}`,{headers:authHeader()});
    const data=await res.json();
    entries=data.history||[];
  }catch{showToast("Could not load history",true);return;}

  let rows="";
  if(entries.length===0){
    rows=`<tr><td colspan="5" style="text-align:center;color:#b0bec8;font-style:italic;padding:1.25rem">No history recorded yet.</td></tr>`;
  }else{
    entries.forEach(h=>{
      const d=new Date(h.changed_at);
      const dateStr=d.toLocaleDateString("en-GH",{day:"2-digit",month:"short",year:"numeric"});
      const timeStr=d.toLocaleTimeString("en-GH",{hour:"2-digit",minute:"2-digit"});
      const rem=parseFloat(h.amount_remaining||0);
      rows+=`<tr>
        <td style="white-space:nowrap;font-size:0.78rem">${dateStr}<br><span style="color:var(--muted);font-size:0.7rem">${timeStr}</span></td>
        <td style="font-weight:600">GHS ${parseFloat(h.grand_total||0).toFixed(2)}</td>
        <td style="font-weight:600">GHS ${parseFloat(h.amount_paid||0).toFixed(2)}</td>
        <td style="font-weight:600;color:${rem>0.005?"var(--red)":"var(--green)"}">GHS ${rem.toFixed(2)}</td>
        <td><span class="paid-badge ${h.paid?"paid":"unpaid"}" style="margin-right:0.35rem">${h.paid?"Paid":"Unpaid"}</span><span style="font-size:0.74rem;color:var(--muted)">${escHtml(h.note||"")}</span></td>
      </tr>`;
    });
  }

  // Reuse the existing modal overlay - create a temporary history panel
  const historyHtml=`
    <div class="modal-overlay open" id="historyOverlay" style="z-index:500">
      <div class="modal-panel" style="max-width:680px">
        <div class="modal-header">
          <h2>Invoice History - ${escHtml(invoiceLabel)}</h2>
          <button class="modal-close" onclick="document.getElementById('historyOverlay').remove()">✕</button>
        </div>
        <div style="overflow-x:auto">
          <table class="inv-list-table">
            <thead><tr><th>Date &amp; Time</th><th>Total Billed</th><th>Amount Paid</th><th>Remaining</th><th>Status &amp; Note</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p style="font-size:0.74rem;color:var(--muted);margin-top:1rem;line-height:1.6">Each row is a snapshot saved every time this invoice was created, edited, or marked as paid.</p>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend",historyHtml);
  document.getElementById("historyOverlay").addEventListener("click",e=>{
    if(e.target===document.getElementById("historyOverlay"))document.getElementById("historyOverlay").remove();
  });
}

// Mark invoice fully paid: sets amount_paid = grand_total, amount_remaining = 0, paid = true.
// Uses PATCH so the real payment figures are written to the database - not just a flag flip.
async function markInvoiceFullyPaid(id){
  if(!viewingPatient)return;
  // Confirm with staff before settling
  if(!confirm("Mark this invoice as fully paid?\nThis will record the full outstanding balance as received and cannot be undone here."))return;

  // Fetch fresh invoice data so we have the exact grand_total and items
  const params=new URLSearchParams({ref:viewingPatient});
  let inv;
  try{
    const res=await fetch(`${API_BASE}/api/invoices?${params}`,{headers:authHeader()});
    const data=await res.json();
    inv=data.invoices.find(i=>i.id===id);
  }catch{showToast("Could not fetch invoice",true);return;}
  if(!inv){showToast("Invoice not found",true);return;}

  const grand=parseFloat(inv.grand_total||0);
  const payload={
    
    id,
    reference_number:inv.reference_number,
    invoice_number:inv.invoice_number||null,
    date:inv.date,
    discount_pct:0,
    discount_amount:parseFloat(inv.discount_amount||0),
    subtotal:parseFloat(inv.subtotal||grand),
    grand_total:grand,
    amount_paid:grand,        // ← full amount recorded as received
    amount_remaining:0,       // ← no balance outstanding
    paid:true,
    items:(inv.invoice_items||[]).map(it=>({
      procedure:it.procedure,qty:it.qty,
      unit_price:parseFloat(it.unit_price||0),
      total_price:parseFloat(it.total_price||0),
      patient_share:parseFloat(it.patient_share||0),
    })),
  };
  try{
    const res=await fetch(`${API_BASE}/api/invoices`,{method:"PATCH",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify(payload)});
    const data=await res.json();
    if(res.ok){showToast("✅ Invoice marked as fully paid");refreshInvoiceList();}
    else showToast(data.error||"Failed",true);
  }catch{showToast("Network error",true);}
}

async function deleteInvoice(id){
  if(!confirm("Delete this invoice?"))return;
  try{
    const res=await fetch(`${API_BASE}/api/invoices`,{method:"DELETE",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify({id})});
    const data=await res.json();
    if(res.ok){showToast("✅ Deleted");refreshInvoiceList();}else showToast(data.error||"Failed",true);
  }catch{showToast("Network error",true);}
}

async function refreshInvoiceList(){
  if(!viewingPatient)return;
  const params=new URLSearchParams({ref:viewingPatient});
  const res=await fetch(`${API_BASE}/api/invoices?${params}`,{headers:authHeader()});const data=await res.json();
  const el=document.getElementById("invoiceList");
  if(el)el.innerHTML=renderInvoiceList(data.invoices||[],data.total||0,data.unpaid||0);
}

// Edit invoice - load existing data into modal
async function editInvoice(id){
  // fetch all invoices for this patient and find by id
  if(!viewingPatient)return;
  const params=new URLSearchParams({ref:viewingPatient});
  const res=await fetch(`${API_BASE}/api/invoices?${params}`,{headers:authHeader()});const data=await res.json();
  const inv=data.invoices.find(i=>i.id===id);
  if(!inv){showToast("Invoice not found",true);return;}
  // open modal pre-filled
  const p=allPatients.find(p=>p.reference_number===viewingPatient);
  openInvoiceModal(viewingPatient,p?.name||viewingPatient,viewingPatient,inv);
}