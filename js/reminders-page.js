// ═══════════════════════════════════════════════════════════════
//  REMINDERS PAGE (Phase 5 SMS)
// ═══════════════════════════════════════════════════════════════

let allSMSPatients = []; // Store all patients for filtering
let smsFilterState = { search: '', filterType: null, currentPage: 1 }; // Current filter state
const SMS_PAGE_SIZE = 50;

// Test trigger: manually run a cron job for testing
async function testSMSTrigger(trigger){
  const triggerNames={
    "cron":"Appointment Reminders",
    "birthday":"Birthday SMS",
    "holiday":"Holiday Greetings",
    "review":"Review Reminders",
    "followup":"Follow-up SMS"
  };
  if(!confirm(`Send test ${triggerNames[trigger] || trigger}? This will send real SMS to matching patients.`))return;
  try{
    const res=await fetch(`${API_BASE}/api/sms`,{
      method:"POST",
      headers:{"Content-Type":"application/json",...authHeader()},
      body:JSON.stringify({trigger})
    });
    const data=await res.json();
    if(res.ok){
      showToast(`✅ Sent: ${data.sent}, Skipped: ${data.skipped}, Failed: ${data.failed}`);
    }else showToast(data.error||"Failed",true);
  }catch{showToast("Network error",true);}
}

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

// Load patient SMS opt-outs
async function loadSMSOptOuts(){
  const container=document.getElementById("smsOptOutList");
  if(!container)return;
  container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--muted)">Loading…</div>`;
  try{
    const res=await fetch(`${API_BASE}/api/patients?page=1&limit=1000`,{headers:authHeader()});
    if(!res.ok){
      container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--red)">Failed to load patients (${res.status}).</div>`;
      return;
    }
    const data=await res.json();
    allSMSPatients=data.patients||[];
    if(allSMSPatients.length===0){container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:#b0bec8;font-style:italic">No patients found.</div>`;return;}
    renderSMSPreferencesTable();
  }catch(e){
    console.error("Error loading SMS opt-outs:",e);
    container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--red)">Failed to load patients.</div>`;
  }
}

// Render SMS preferences table with current filter and pagination
function renderSMSPreferencesTable(){
  const container=document.getElementById("smsOptOutList");
  let filtered=allSMSPatients;

  // Apply search filter
  if(smsFilterState.search){
    const q=smsFilterState.search.toLowerCase();
    filtered=filtered.filter(p=>p.name.toLowerCase().includes(q)||p.reference_number.toLowerCase().includes(q));
  }

  // Apply opted-in/out filter
  if(smsFilterState.filterType==='opted-out'){
    filtered=filtered.filter(p=>p.sms_optout_birthday||p.sms_optout_holiday||p.sms_optout_review||p.sms_optout_followup);
  }else if(smsFilterState.filterType==='opted-in'){
    filtered=filtered.filter(p=>!p.sms_optout_birthday&&!p.sms_optout_holiday&&!p.sms_optout_review&&!p.sms_optout_followup);
  }

  // Pagination
  const totalPages=Math.ceil(filtered.length/SMS_PAGE_SIZE);
  if(smsFilterState.currentPage>totalPages&&totalPages>0)smsFilterState.currentPage=totalPages;
  if(smsFilterState.currentPage<1)smsFilterState.currentPage=1;

  const start=(smsFilterState.currentPage-1)*SMS_PAGE_SIZE;
  const end=start+SMS_PAGE_SIZE;
  const pageData=filtered.slice(start,end);

  let html=`<table style="width:100%;border-collapse:collapse;font-size:0.8rem">
    <thead><tr>
      <th style="padding:0.5rem 0.85rem;text-align:left;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Patient</th>
      <th style="padding:0.5rem 0.85rem;text-align:center;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Birthday</th>
      <th style="padding:0.5rem 0.85rem;text-align:center;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Holiday</th>
      <th style="padding:0.5rem 0.85rem;text-align:center;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Review</th>
      <th style="padding:0.5rem 0.85rem;text-align:center;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Followup</th>
    </tr></thead><tbody>`;

  pageData.forEach(p=>{
    const birth = p.sms_optout_birthday ? 'checked' : '';
    const hol = p.sms_optout_holiday ? 'checked' : '';
    const rev = p.sms_optout_review ? 'checked' : '';
    const fup = p.sms_optout_followup ? 'checked' : '';
    html+=`<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:0.45rem 0.85rem"><strong>${escHtml(p.name)}</strong><br><span style="font-size:0.7rem;color:var(--muted)">${escHtml(p.reference_number)}</span></td>
      <td style="padding:0.45rem 0.85rem;text-align:center">
        <input type="checkbox" id="optout-birth-${p.reference_number}" ${birth} onchange="updateSMSOptOut('${p.reference_number}','birthday',this.checked)">
      </td>
      <td style="padding:0.45rem 0.85rem;text-align:center">
        <input type="checkbox" id="optout-hol-${p.reference_number}" ${hol} onchange="updateSMSOptOut('${p.reference_number}','holiday',this.checked)">
      </td>
      <td style="padding:0.45rem 0.85rem;text-align:center">
        <input type="checkbox" id="optout-rev-${p.reference_number}" ${rev} onchange="updateSMSOptOut('${p.reference_number}','review',this.checked)">
      </td>
      <td style="padding:0.45rem 0.85rem;text-align:center">
        <input type="checkbox" id="optout-fup-${p.reference_number}" ${fup} onchange="updateSMSOptOut('${p.reference_number}','followup',this.checked)">
      </td>
    </tr>`;
  });
  html+=`</tbody></table>`;

  // Pagination footer
  let paginationHtml=`<div style="padding:1rem;background:var(--surface);border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;font-size:0.8rem;color:var(--muted)">`;
  paginationHtml+=`<div>Showing ${pageData.length>0?start+1:0}–${Math.min(end,filtered.length)} of ${filtered.length} patient(s)</div>`;

  if(totalPages>1){
    paginationHtml+=`<div style="display:flex;gap:0.3rem">`;
    if(smsFilterState.currentPage>1){
      paginationHtml+=`<button class="btn-ghost btn-sm" onclick="changeSMSPage(${smsFilterState.currentPage-1})">← Prev</button>`;
    }
    paginationHtml+=`<span style="padding:0.3rem 0.6rem;background:white;border:1px solid var(--border);border-radius:4px">${smsFilterState.currentPage}/${totalPages}</span>`;
    if(smsFilterState.currentPage<totalPages){
      paginationHtml+=`<button class="btn-ghost btn-sm" onclick="changeSMSPage(${smsFilterState.currentPage+1})">Next →</button>`;
    }
    paginationHtml+=`</div>`;
  }
  paginationHtml+=`</div>`;

  container.innerHTML=html+paginationHtml;
}

// Filter SMS preferences by search term
function filterSMSPreferences(){
  const input=document.getElementById("smsFilterInput")?.value||"";
  smsFilterState.search=input;
  smsFilterState.currentPage=1;
  renderSMSPreferencesTable();
}

// Change SMS page
function changeSMSPage(page){
  smsFilterState.currentPage=page;
  renderSMSPreferencesTable();
}

// Toggle filter button (opted-out / opted-in)
function toggleSMSFilter(filterType){
  smsFilterState.filterType=smsFilterState.filterType===filterType?null:filterType;
  smsFilterState.currentPage=1;
  renderSMSPreferencesTable();
  updateSMSFilterButtonStyles();
}

// Clear all filters
function clearSMSFilters(){
  smsFilterState={search:'',filterType:null,currentPage:1};
  const input=document.getElementById("smsFilterInput");
  if(input)input.value="";
  renderSMSPreferencesTable();
  updateSMSFilterButtonStyles();
}

function updateSMSFilterButtonStyles(){
  const btnOut = document.getElementById("btnFilterOptedOut");
  const btnIn = document.getElementById("btnFilterOptedIn");
  if(btnOut) btnOut.classList.toggle("active", smsFilterState.filterType==='opted-out');
  if(btnIn) btnIn.classList.toggle("active", smsFilterState.filterType==='opted-in');
}

// Bulk update all displayed SMS preferences
async function bulkSMSOptOut(isOptedOut){
  const actionName = isOptedOut ? 'opt in' : 'opt out';
  if(!confirm(`Are you sure you want to ${actionName} all currently filtered patients for all SMS types?`))return;
  showToast("Updating preferences in database…");
  try{
    const search = smsFilterState.search ? smsFilterState.search.toLowerCase() : "";
    let filtered = allSMSPatients;
    if(search){
      filtered=filtered.filter(p=>p.name.toLowerCase().includes(search)||p.reference_number.toLowerCase().includes(search));
    }
    if(smsFilterState.filterType==='opted-out'){
      filtered=filtered.filter(p=>p.sms_optout_birthday||p.sms_optout_holiday||p.sms_optout_review||p.sms_optout_followup);
    }else if(smsFilterState.filterType==='opted-in'){
      filtered=filtered.filter(p=>!p.sms_optout_birthday&&!p.sms_optout_holiday&&!p.sms_optout_review&&!p.sms_optout_followup);
    }

    // Prepare items array for bulk request
    const items = filtered.map(p => {
      p.sms_optout_birthday = isOptedOut;
      p.sms_optout_holiday = isOptedOut;
      p.sms_optout_review = isOptedOut;
      p.sms_optout_followup = isOptedOut;
      return {
        reference_number: p.reference_number,
        sms_optout_birthday: isOptedOut,
        sms_optout_holiday: isOptedOut,
        sms_optout_review: isOptedOut,
        sms_optout_followup: isOptedOut
      };
    });

    // Send in chunks of 150 to avoid request body limits
    for(let i=0; i<items.length; i+=150){
      const chunk = items.slice(i, i+150);
      await fetch(`${API_BASE}/api/patients`,{
        method:"PUT",
        headers:{"Content-Type":"application/json",...authHeader()},
        body:JSON.stringify({ bulk: true, items: chunk })
      });
    }

    renderSMSPreferencesTable();
    showToast("✅ Bulk update completed successfully");
  }catch(e){
    console.error("Bulk update error:", e);
    showToast("Failed to bulk update",true);
  }
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
    if(!res.ok)showToast(data.error||"Failed to update",true);
  }catch{showToast("Network error",true);}
}

// Load on page switch to Reminders
let remindersPageInitialized = false;

// Override showPage to initialize pages when switched (only if not already wrapped)
if(!window.originalShowPageReminders){
  window.originalShowPageReminders = window.showPage;
  const prevShowPage = window.showPage;
  window.showPage = function(pageId){
    prevShowPage(pageId);
    if(pageId === "reminders" && !remindersPageInitialized){
      loadSMSOptOuts();
      populateTestPatientDropdown();
      remindersPageInitialized = true;
    }
  };
}

// Populate patient dropdown for testing
async function populateTestPatientDropdown(){
  const select=document.getElementById("testPatientRef");
  if(!select)return;
  try{
    const res=await fetch(`${API_BASE}/api/patients?page=1&limit=1000`,{headers:authHeader()});
    if(!res.ok)return;
    const data=await res.json();
    const patients=data.patients||[];
    patients.forEach(p=>{
      const opt=document.createElement("option");
      opt.value=p.reference_number;
      opt.textContent=`${p.name} (${p.reference_number})`;
      select.appendChild(opt);
    });
  }catch(e){console.error("Failed to load patients for dropdown:",e);}
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

