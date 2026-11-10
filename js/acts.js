// ═══════════════════════════════════════════════════════════════
//  MEDICAL ACTS - loaded from database on login
// ═══════════════════════════════════════════════════════════════
let ACT_PRICES = {};   // name → price, populated after login
let ACTS       = [];   // sorted names array, populated after login

async function loadMedicalActs(){
  try{
    const res=await fetch(`${API_BASE}/api/acts`,{headers:authHeader()});
    const data=await res.json();
    ACT_PRICES={};
    (data.acts||[]).forEach(a=>{ACT_PRICES[a.name]=parseFloat(a.price)||0;});
    ACTS=Object.keys(ACT_PRICES).sort();
  }catch(e){
    console.error("Could not load medical acts",e);
  }
}

// ═══════════════════════════════════════════════════════════════
//  MEDICAL ACTS MANAGER
// ═══════════════════════════════════════════════════════════════
async function toggleActsManager(){
  const body=document.getElementById("actsManagerBody");
  const toggle=document.getElementById("actsManagerToggle");
  if(!body)return;
  if(body.style.display==="none"){
    body.style.display="block";
    toggle.textContent="Hide ▴";
    await renderActsList();
  }else{
    body.style.display="none";
    toggle.textContent="Show ▾";
  }
}

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
        <th style="padding:0.5rem 0.85rem;background:var(--surface);border-bottom:1px solid var(--border);width:120px"></th>
      </tr></thead><tbody>`;
    acts.forEach(a=>{
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

async function saveNewAct(){
  const name=(document.getElementById("newActName").value||"").trim().toUpperCase();
  const price=parseFloat(document.getElementById("newActPrice").value)||0;
  if(!name){showToast("Please enter a procedure name",true);return;}
  try{
    const res=await fetch(`${API_BASE}/api/acts`,{method:"POST",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify({name,price})});
    const data=await res.json();
    if(res.ok){
      showToast("✅ Act added");
      document.getElementById("newActName").value="";
      document.getElementById("newActPrice").value="";
      await loadMedicalActs();   // refresh the in-memory list for dropdowns
      await renderActsList();
    }else showToast(data.error||"Failed",true);
  }catch{showToast("Network error",true);}
}

async function updateAct(id){
  const name=(document.getElementById(`act-name-${id}`)?.value||"").trim().toUpperCase();
  const price=parseFloat(document.getElementById(`act-price-${id}`)?.value)||0;
  if(!name){showToast("Name cannot be empty",true);return;}
  try{
    const res=await fetch(`${API_BASE}/api/acts`,{method:"PUT",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify({id,name,price})});
    const data=await res.json();
    if(res.ok){showToast("✅ Act updated");await loadMedicalActs();await renderActsList();}
    else showToast(data.error||"Failed",true);
  }catch{showToast("Network error",true);}
}

async function deleteAct(id){
  if(!confirm("Remove this act from the dropdown?\n\nIt will be hidden but existing invoices won't be affected."))return;
  try{
    const res=await fetch(`${API_BASE}/api/acts`,{method:"DELETE",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify({id})});
    const data=await res.json();
    if(res.ok){showToast("✅ Act removed");await loadMedicalActs();await renderActsList();}
    else showToast(data.error||"Failed",true);
  }catch{showToast("Network error",true);}
}