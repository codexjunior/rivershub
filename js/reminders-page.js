// ═══════════════════════════════════════════════════════════════
//  REMINDERS PAGE (Phase 5 SMS)
// ═══════════════════════════════════════════════════════════════

let allSMSPatients = []; // Store all patients for filtering
let smsFilterState = { search: '', filterType: null }; // Current filter state

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
    // Load ALL patients with pagination
    let allPatients = [];
    let page = 1;
    let hasMore = true;
    while(hasMore){
      const url=`${API_BASE}/api/patients?page=${page}&limit=100${authQuery()}`;
      const res=await fetch(url,{headers:authHeader()});
      if(!res.ok){
        console.error(`Failed to fetch patients page ${page}:`,res.status,res.statusText);
        container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--red)">Failed to load patients (${res.status}).</div>`;
        return;
      }
      const data=await res.json();
      const patients=data.patients||[];
      if(patients.length===0){hasMore=false;break;}
      allPatients=allPatients.concat(patients);
      if(patients.length<100){hasMore=false;}
      page++;
    }
    allSMSPatients=allPatients;
    if(allSMSPatients.length===0){container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:#b0bec8;font-style:italic">No patients found.</div>`;return;}
    renderSMSPreferencesTable();
  }catch(e){
    console.error("Error loading SMS opt-outs:",e);
    container.innerHTML=`<div style="padding:1rem;font-size:0.82rem;color:var(--red)">Failed to load patients.</div>`;
  }
}

// Render SMS preferences table with current filter
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

  let html=`<table style="width:100%;border-collapse:collapse;font-size:0.8rem">
    <thead><tr>
      <th style="padding:0.5rem 0.85rem;text-align:left;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Patient</th>
      <th style="padding:0.5rem 0.85rem;text-align:center;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Birthday</th>
      <th style="padding:0.5rem 0.85rem;text-align:center;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Holiday</th>
      <th style="padding:0.5rem 0.85rem;text-align:center;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Review</th>
      <th style="padding:0.5rem 0.85rem;text-align:center;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border)">Followup</th>
    </tr></thead><tbody>`;

  filtered.forEach(p=>{
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
  html+=`<div style="padding:0.75rem 1rem;background:var(--surface);border-top:1px solid var(--border);font-size:0.8rem;color:var(--muted)">Showing ${filtered.length} of ${allSMSPatients.length} patient(s)</div>`;
  container.innerHTML=html;
}

// Filter SMS preferences by search term
function filterSMSPreferences(){
  const input=document.getElementById("smsFilterInput")?.value||"";
  smsFilterState.search=input;
  renderSMSPreferencesTable();
}

// Toggle filter button (opted-out / opted-in)
function toggleSMSFilter(filterType){
  smsFilterState.filterType=smsFilterState.filterType===filterType?null:filterType;
  renderSMSPreferencesTable();
}

// Clear all filters
function clearSMSFilters(){
  smsFilterState={search:'',filterType:null};
  document.getElementById("smsFilterInput").value="";
  renderSMSPreferencesTable();
}

// Update SMS opt-out preference
async function updateSMSOptOut(ref, type, isOptedOut){
  try{
    const colMap={'birthday':'sms_optout_birthday','holiday':'sms_optout_holiday','review':'sms_optout_review','followup':'sms_optout_followup'};
    const col=colMap[type];
    const res=await fetch(`${API_BASE}/api/patients`,{
      method:"PATCH",
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

// Populate patient dropdown for testing
async function populateTestPatientDropdown(){
  const select=document.getElementById("testPatientRef");
  if(!select)return;
  try{
    // Load ALL patients with pagination
    let allPatients = [];
    let page = 1;
    let hasMore = true;
    while(hasMore){
      const url=`${API_BASE}/api/patients?page=${page}&limit=100${authQuery()}`;
      const res=await fetch(url,{headers:authHeader()});
      if(!res.ok){
        console.error(`Failed to fetch patients page ${page}:`,res.status);
        break;
      }
      const data=await res.json();
      const patients=data.patients||[];
      if(patients.length===0){hasMore=false;break;}
      patients.forEach(p=>{
        const opt=document.createElement("option");
        opt.value=p.reference_number;
        opt.textContent=`${p.name} (${p.reference_number})`;
        select.appendChild(opt);
      });
      if(patients.length<100){hasMore=false;}
      page++;
    }
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

