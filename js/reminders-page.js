// ═══════════════════════════════════════════════════════════════
//  REMINDERS PAGE (Phase 5 SMS) - Redesigned
// ═══════════════════════════════════════════════════════════════

let allSMSPatients = [];
let smsSearchState = { query: '', currentPage: 1 };
const SMS_PAGE_SIZE = 50;

// Manual SMS send
async function sendManualSMS(){
  const phone=(document.getElementById("manualSMSPhone")?.value||"").trim();
  const message=(document.getElementById("manualSMSMessage")?.value||"").trim();
  if(!phone){showToast("Please enter a phone number",true);return;}
  if(!message){showToast("Please enter a message",true);return;}
  try{
    const res=await fetch(`${API_BASE}/api/sms`,{
      method:"POST",
      headers:{"Content-Type":"application/json",...authHeader()},
      body:JSON.stringify({phone,message})
    });
    const data=await res.json();
    if(res.ok){
      showToast("✅ SMS sent successfully");
      document.getElementById("manualSMSPhone").value="";
      document.getElementById("manualSMSMessage").value="";
    }else showToast(data.error||"Failed",true);
  }catch{showToast("Network error",true);}
}

// Filter SMS patients by search
function filterSMSPatients(){
  const query=document.getElementById("smsPatientSearch")?.value||"";
  smsSearchState.query=query.toLowerCase();
  smsSearchState.currentPage=1;
  renderSMSPatientResults();
}

// Clear search
function clearSMSSearch(){
  document.getElementById("smsPatientSearch").value="";
  smsSearchState.query="";
  smsSearchState.currentPage=1;
  renderSMSPatientResults();
}

// Render patient search results with toggles
function renderSMSPatientResults(){
  const container=document.getElementById("smsPatientResults");
  if(!smsSearchState.query){
    container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--muted);text-align:center">Type to search patients</div>`;
    return;
  }

  let filtered=allSMSPatients.filter(p=>
    p.name.toLowerCase().includes(smsSearchState.query)||
    p.reference_number.toLowerCase().includes(smsSearchState.query)
  );

  if(filtered.length===0){
    container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--muted);text-align:center">No patients found</div>`;
    return;
  }

  // Pagination
  const totalPages=Math.ceil(filtered.length/SMS_PAGE_SIZE);
  if(smsSearchState.currentPage>totalPages)smsSearchState.currentPage=totalPages;
  if(smsSearchState.currentPage<1)smsSearchState.currentPage=1;

  const start=(smsSearchState.currentPage-1)*SMS_PAGE_SIZE;
  const end=start+SMS_PAGE_SIZE;
  const pageData=filtered.slice(start,end);

  let html=`<div style="padding:1rem">`;
  pageData.forEach(p=>{
    html+=`<div style="padding:1rem;border:1px solid var(--border);border-radius:6px;margin-bottom:0.75rem;background:var(--surface)">
      <div style="font-weight:600;color:var(--text);margin-bottom:0.5rem">${escHtml(p.name)}</div>
      <div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.75rem">${escHtml(p.reference_number)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;cursor:pointer">
          <input type="checkbox" ${p.sms_optout_birthday?'checked':''} onchange="updateSMSOptOut('${p.reference_number}','birthday',this.checked)">
          <span>Birthday</span>
        </label>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;cursor:pointer">
          <input type="checkbox" ${p.sms_optout_holiday?'checked':''} onchange="updateSMSOptOut('${p.reference_number}','holiday',this.checked)">
          <span>Holiday</span>
        </label>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;cursor:pointer">
          <input type="checkbox" ${p.sms_optout_review?'checked':''} onchange="updateSMSOptOut('${p.reference_number}','review',this.checked)">
          <span>Review</span>
        </label>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;cursor:pointer">
          <input type="checkbox" ${p.sms_optout_followup?'checked':''} onchange="updateSMSOptOut('${p.reference_number}','followup',this.checked)">
          <span>Followup</span>
        </label>
      </div>
    </div>`;
  });
  html+=`</div>`;

  // Pagination footer
  if(totalPages>1){
    html+=`<div style="padding:0.75rem 1rem;background:var(--surface);border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:var(--muted)">
      <div>Page ${smsSearchState.currentPage}/${totalPages}</div>
      <div style="display:flex;gap:0.3rem">`;
    if(smsSearchState.currentPage>1){
      html+=`<button class="btn-ghost btn-sm" onclick="changeSMSPage(${smsSearchState.currentPage-1})">← Prev</button>`;
    }
    if(smsSearchState.currentPage<totalPages){
      html+=`<button class="btn-ghost btn-sm" onclick="changeSMSPage(${smsSearchState.currentPage+1})">Next →</button>`;
    }
    html+=`</div></div>`;
  }

  container.innerHTML=html;
}

// Change page
function changeSMSPage(page){
  smsSearchState.currentPage=page;
  renderSMSPatientResults();
}

// Update SMS opt-out preference
async function updateSMSOptOut(ref, type, isOptedOut){
  try{
    const colMap={'birthday':'sms_optout_birthday','holiday':'sms_optout_holiday','review':'sms_optout_review','followup':'sms_optout_followup'};
    const col=colMap[type];
    const res=await fetch(`${API_BASE}/api/patients`,{
      method:"PUT",
      headers:{"Content-Type":"application/json",...authHeader()},
      body:JSON.stringify({reference_number:ref,[col]:isOptedOut})
    });
    const data=await res.json();
    if(res.ok){
      /* Update local cache */
      const patient=allSMSPatients.find(p=>p.reference_number===ref);
      if(patient)patient[col]=isOptedOut;
      showToast(isOptedOut?`✅ ${type} opt-out enabled`:`✅ ${type} opt-out disabled`);
    }else showToast(data.error||"Failed to update",true);
  }catch{showToast("Network error",true);}
}

// Load SMS patients (first page only, rest in background)
async function loadSMSPatients(){
  try{
    const loadPage = async (pageNum) => {
      const url=`${API_BASE}/api/patients?page=${pageNum}&limit=100${authQuery()}`;
      const res=await fetch(url,{headers:authHeader()});
      if(!res.ok) return null;
      return await res.json();
    };

    // Load first page immediately
    const firstData = await loadPage(1);
    if(!firstData) return;
    const firstPatients = firstData.patients || [];
    allSMSPatients = [...firstPatients];

    // Load remaining pages in background (non-blocking)
    let page = 2;
    while(true){
      const data = await loadPage(page);
      if(!data) break;
      const patients = data.patients || [];
      if(patients.length === 0) break;
      allSMSPatients = allSMSPatients.concat(patients);
      if(patients.length < 100) break;
      page++;
    }

  }catch(e){
    console.error("Error loading SMS patients:",e);
  }
}

// Populate test patient dropdown
async function populateTestPatientDropdown(){
  const select=document.getElementById("testPatientRef");
  if(!select)return;
  try{
    if(allSMSPatients.length === 0){
      await loadSMSPatients();
    }
    allSMSPatients.forEach(p=>{
      const opt=document.createElement("option");
      opt.value=p.reference_number;
      opt.textContent=`${p.name} (${p.reference_number})`;
      select.appendChild(opt);
    });
  }catch(e){console.error("Failed to populate test patient dropdown:",e);}
}

// Send all 5 SMS types to a single patient for testing
async function sendTestToPatient(){
  const ref=document.getElementById("testPatientRef")?.value;
  if(!ref){showToast("Please select a patient",true);return;}
  if(!confirm(`Send all 5 test SMS types to ${ref}?\n\nBirthday, Holiday, Review, Followup, and one Appointment reminder.\n\nThis will send real SMS to the patient's phone number.`))return;

  try{
    const res=await fetch(`${API_BASE}/api/sms`,{
      method:"POST",
      headers:{"Content-Type":"application/json",...authHeader()},
      body:JSON.stringify({trigger:"test-all",reference_number:ref})
    });
    const data=await res.json();
    if(res.ok){
      showToast(`✅ Test SMS sent!\n\nBirthday: ${data.birthday||'skipped'}\nHoliday: ${data.holiday||'skipped'}\nReview: ${data.review||'skipped'}\nFollowup: ${data.followup||'skipped'}\nAppointment: ${data.appointment||'skipped'}`);
    }else showToast(data.error||"Failed to send test",true);
  }catch{showToast("Network error",true);}
}

// Load on page switch to Reminders
let remindersPageInitialized = false;

if(!window.pageInitializers){window.pageInitializers={};}
window.pageInitializers.reminders=function(){
  if(remindersPageInitialized)return;
  loadSMSPatients();
  populateTestPatientDropdown();
  remindersPageInitialized = true;
};
