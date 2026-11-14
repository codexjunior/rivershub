// ═══════════════════════════════════════════════════════════════
//  ACTS MANAGEMENT PAGE (Phase 5)
// ═══════════════════════════════════════════════════════════════

async function renderActsList(){
  const container=document.getElementById("actsList");
  if(!container)return;
  container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--muted)">Loading…</div>`;
  try{
    const res=await fetch(`${API_BASE}/api/acts`,{headers:authHeader()});
    const data=await res.json();
    const acts=data.acts||[];
    if(acts.length===0){container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:#b0bec8;font-style:italic">No acts found.</div>`;return;}
    let html=`<table style="width:100%;border-collapse:collapse;font-size:0.8rem">
      <thead><tr>
        <th style="padding:0.5rem 0.85rem;text-align:left;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Procedure</th>
        <th style="padding:0.5rem 0.85rem;text-align:left;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Price (GHS)</th>
        <th style="padding:0.5rem 0.85rem;text-align:left;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Recall (months)</th>
        <th style="padding:0.5rem 0.85rem;background:var(--surface);border-bottom:1px solid var(--border);width:120px"></th>
      </tr></thead><tbody>`;
    acts.forEach(a=>{
      const recallVal = a.review_months !== null && a.review_months !== undefined ? a.review_months : '';
      html+=`<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:0.45rem 0.85rem">
          <input type="text" value="${escAttr(a.name)}" id="act-name-${a.id}"
            style="border:1px solid var(--border);border-radius:6px;padding:0.28rem 0.5rem;font-size:0.79rem;font-family:'Plus Jakarta Sans',sans-serif;width:100%;text-transform:uppercase">
        </td>
        <td style="padding:0.45rem 0.85rem">
          <input type="number" value="${a.price}" id="act-price-${a.id}" min="0" step="0.01"
            style="border:1px solid var(--border);border-radius:6px;padding:0.28rem 0.5rem;font-size:0.79rem;font-family:'Plus Jakarta Sans',sans-serif;width:80px;text-align:right">
        </td>
        <td style="padding:0.45rem 0.85rem">
          <input type="number" value="${recallVal}" id="act-recall-${a.id}" min="0" step="1" placeholder="—"
            style="border:1px solid var(--border);border-radius:6px;padding:0.28rem 0.5rem;font-size:0.79rem;font-family:'Plus Jakarta Sans',sans-serif;width:80px;text-align:right">
        </td>
        <td style="padding:0.45rem 0.85rem">
          <div style="display:flex;gap:0.3rem">
            <button class="inv-action-btn edit" onclick="updateAct('${a.id}')">Save</button>
            <button class="inv-action-btn del" onclick="deleteAct('${a.id}')">Remove</button>
          </div>
        </td>
      </tr>`;
    });
    html+=`</tbody></table>`;
    container.innerHTML=html;
  }catch{container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--red)">Failed to load acts.</div>`;}
}
