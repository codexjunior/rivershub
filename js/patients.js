// ═══════════════════════════════════════════════════════════════
//  PATIENTS
// ═══════════════════════════════════════════════════════════════
let allPatients=[],patientPage=1,patientTotal=0;
let viewingPatient=null,editingPatient=null;
const PATIENT_LIMIT=20;

async function loadPatients(page=1,search=""){
  document.getElementById("patientListScroll").innerHTML=`<div class="state-msg" style="padding:2rem 1rem"><div class="icon" style="font-size:1.8rem">👤</div><p style="font-size:0.8rem">Loading…</p></div>`;
  try{
    const params=new URLSearchParams({page,limit:PATIENT_LIMIT,search});
    const res=await fetch(`${API_BASE}/api/patients?${params}`,{headers:authHeader()});
    const data=await res.json();
    allPatients=data.patients||[];patientTotal=data.total||0;patientPage=page;
    renderPatientList();
  }catch{document.getElementById("patientListScroll").innerHTML=`<div class="state-msg" style="padding:2rem 1rem"><div class="icon">⚠️</div><p style="font-size:0.8rem">Failed to load.</p></div>`;}
}

function renderPatientList(){
  const search=document.getElementById("patientSearch").value.trim();
  const totalPages=Math.ceil(patientTotal/PATIENT_LIMIT);
  document.getElementById("patientCount").textContent=`${patientTotal} patient${patientTotal!==1?"s":""}`;
  if(allPatients.length===0){
    document.getElementById("patientListScroll").innerHTML=`<div class="state-msg" style="padding:2rem 1rem"><div class="icon" style="font-size:1.8rem">👤</div><p style="font-size:0.8rem">${search?"No patients found.":"No patients yet."}</p></div>`;
    document.getElementById("patientListPagination").innerHTML="";return;
  }
  let html="";
  allPatients.forEach(p=>{
    const initials=(p.name||p.reference_number||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    const gCls=p.gender===0?"male":p.gender===1?"female":"";
    const isActive=viewingPatient===p.reference_number;
    html+=`<div class="pt-row${isActive?" active":""}" onclick="viewPatient('${escAttr(p.reference_number)}')">
      <div class="pt-avatar ${gCls}">${initials}</div>
      <div class="pt-row-info">
        <div class="pt-row-name">${escHtml(p.name||"No name")}</div>
        <div class="pt-row-ref">${escHtml(p.reference_number)}</div>
        <div class="pt-row-sub">${escHtml([p.phone,p.profession].filter(Boolean).join(" · ")||"-")}</div>
      </div>
    </div>`;
  });
  document.getElementById("patientListScroll").innerHTML=html;

  // pagination in left panel
  let pgHtml="";
  if(totalPages>1){
    pgHtml=`<div style="display:flex;gap:0.25rem;justify-content:center;flex-wrap:wrap">`;
    pgHtml+=`<button class="page-btn" style="padding:0.28rem 0.55rem;font-size:0.72rem" onclick="loadPatients(${patientPage-1},document.getElementById('patientSearch').value)" ${patientPage===1?"disabled":""}>←</button>`;
    for(let i=1;i<=totalPages;i++){
      if(i===1||i===totalPages||Math.abs(i-patientPage)<=1)pgHtml+=`<button class="page-btn${i===patientPage?" active":""}" style="padding:0.28rem 0.55rem;font-size:0.72rem" onclick="loadPatients(${i},document.getElementById('patientSearch').value)">${i}</button>`;
      else if(Math.abs(i-patientPage)===2)pgHtml+=`<span class="page-ellipsis" style="font-size:0.72rem">…</span>`;
    }
    pgHtml+=`<button class="page-btn" style="padding:0.28rem 0.55rem;font-size:0.72rem" onclick="loadPatients(${patientPage+1},document.getElementById('patientSearch').value)" ${patientPage===totalPages?"disabled":""}>→</button></div>`;
  }
  document.getElementById("patientListPagination").innerHTML=pgHtml;
}

// ── View patient (right pane) ──────────────────────────────────
async function viewPatient(ref){
  viewingPatient=ref;
  // highlight in list
  document.querySelectorAll(".pt-row").forEach(r=>{r.classList.toggle("active",r.onclick&&r.getAttribute("onclick")?.includes(escAttr(ref)));});
  // mark active properly
  document.querySelectorAll(".pt-row").forEach(r=>{
    r.classList.remove("active");
    if(r.getAttribute("onclick")&&r.getAttribute("onclick").includes(`'${escAttr(ref)}'`))r.classList.add("active");
  });
  const rp=document.getElementById("patientsRight");
  rp.innerHTML=`<div class="right-empty"><div class="empty-icon" style="font-size:1.75rem;background:white">⏳</div><h3>Loading…</h3></div>`;
  try{
    const params=new URLSearchParams({ref});
    const opts={headers:authHeader()};   // credentials in the header, not the URL
    const [pRes,iRes]=await Promise.all([fetch(`${API_BASE}/api/patients?${params}`,opts),fetch(`${API_BASE}/api/invoices?${params}`,opts)]);
    const pData=await pRes.json();const iData=await iRes.json();
    const p=pData.patient;
    // f(label, value, link?) - link "tel" / "mailto" makes the value tap-to-call / tap-to-mail
    const f=(lbl,val,link)=>{
      const txt=escHtml(val||"-");
      const href=!val||!link?"":link==="tel"?"tel:"+escAttr(String(val).replace(/[^\d+]/g,"")):"mailto:"+escAttr(val);
      return `<div class="info-item"><span class="info-item-label">${lbl}</span><span class="info-item-value${!val?" empty":""}">${href?`<a href="${href}">${txt}</a>`:txt}</span></div>`;
    };
    const facts=[genderLabel(p.gender),ageCatLabel(p.age_category),p.phone].filter(Boolean).map(x=>`<span>${escHtml(x)}</span>`).join("");
    rp.innerHTML=`
    <div class="detail-pane">
      <div class="detail-pane-header">
        <div>
          <div class="detail-pane-name">${escHtml(p.name||p.reference_number)}</div>
          <div class="detail-pane-ref">${escHtml(p.reference_number)}</div>
          ${facts?`<div class="pt-facts">${facts}</div>`:""}
        </div>
        <div class="detail-pane-actions">
          <button class="btn-primary" onclick="openInvoiceModal('${escAttr(ref)}','${escAttr(p.name||ref)}','${escAttr(ref)}')">+ Invoice</button>
          <button class="btn-ghost" onclick="openEditPatientPane(null,'${escAttr(ref)}')">Edit</button>
          <button class="btn-ghost btn-danger" onclick="deletePatient('${escAttr(ref)}','${escAttr(p.name||ref)}')">Delete</button>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header"><span class="info-card-title">Basic Information</span></div>
        <div class="info-card-body">
          <div class="info-grid">
            ${f("Reference",p.reference_number)}${f("Gender",genderLabel(p.gender))}${f("Age Category",ageCatLabel(p.age_category))}
            ${f("Date of Birth",dateLabel(p.birthdate))}${f("Phone",p.phone,"tel")}${f("WhatsApp",p.whatsapp,"tel")}
            ${f("Email",p.email,"mailto")}${f("City",p.city)}${f("Company",p.company)}${f("Profession",p.profession)}
          </div>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header"><span class="info-card-title">Emergency Contact</span></div>
        <div class="info-card-body">
          <div class="info-grid">${f("Name",p.emergency_contact_name)}${f("Relationship",p.emergency_contact_relation)}${f("Phone",p.emergency_contact_phone,"tel")}</div>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header"><span class="info-card-title">Medical Notes</span></div>
        <div class="info-card-body">
          <div class="info-grid">${f("Allergies",p.allergies)}</div>
          ${p.notes?`<div class="info-notes-box">${escHtml(p.notes)}</div>`:""}
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header">
          <span class="info-card-title">Invoices</span>
          <button class="btn-primary btn-sm" onclick="openInvoiceModal('${escAttr(ref)}','${escAttr(p.name||ref)}','${escAttr(ref)}')">+ New Invoice</button>
        </div>
        <div id="invoiceList">
          ${renderInvoiceList(iData.invoices||[],iData.total||0,iData.unpaid||0)}
        </div>
      </div>
      
      <div class="info-card">
        <div class="info-card-header" style="cursor:pointer" onclick="toggleActsManager()">
          <span class="info-card-title">⚙️ Manage Medical Acts</span>
          <span id="actsManagerToggle" style="font-size:0.75rem;color:var(--teal);font-weight:600">Show ▾</span>
        </div>
        <div id="actsManagerBody" style="display:none">
          <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;gap:0.65rem;flex-wrap:wrap;align-items:flex-end">
            <div class="form-field" style="margin-bottom:0;flex:1;min-width:160px">
              <label>Procedure Name</label>
              <input type="text" id="newActName" placeholder="e.g. NEW PROCEDURE" style="text-transform:uppercase">
            </div>
            <div class="form-field" style="margin-bottom:0;width:110px">
              <label>Price (GHS)</label>
              <input type="number" id="newActPrice" placeholder="0.00" min="0" step="0.01">
            </div>
            <button class="btn-primary btn-sm" onclick="saveNewAct()">+ Add Act</button>
          </div>
          <div id="actsList" style="max-height:320px;overflow-y:auto">
            <div style="padding:1rem;font-size:0.82rem;color:var(--muted)">Loading…</div>
          </div>
        </div>
      </div>

    </div>`;
  }catch(err){
    rp.innerHTML=`<div class="right-empty"><div class="empty-icon">⚠️</div><h3>Failed to load</h3><p>Could not load patient details. Please try again.</p></div>`;
  }
}

// ── Edit patient pane ──────────────────────────────────────────
async function openEditPatientPane(patient,refOverride){
  let p=patient;
  if(!p&&refOverride){
    try{
      const params=new URLSearchParams({ref:refOverride});
      const res=await fetch(`${API_BASE}/api/patients?${params}`,{headers:authHeader()});
      const data=await res.json();p=data.patient;
    }catch{showToast("Could not load patient",true);return;}
  }
  editingPatient=p?p.reference_number:null;
  const rp=document.getElementById("patientsRight");

  // new patients get their reference assigned by the server on save
  const refVal = p ? p.reference_number : "";

  rp.innerHTML=`
  <div class="edit-pane">
    <div class="edit-pane-header">
      ${viewingPatient?`<button class="btn-ghost btn-sm" onclick="viewPatient('${escAttr(viewingPatient||editingPatient||"")}')">← Cancel</button>`:"<span></span>"}
      <div class="edit-pane-title">${p?"Edit Patient":"New Patient"}</div>
    </div>
    <div class="form-error" id="patientFormError"></div>

    <div class="form-card">
      <div class="form-section-label">Basic Information</div>
      <div class="form-field"><label>Full Name *</label><input type="text" id="pName" value="${escAttr(p?.name||"")}" placeholder="e.g. Kofi Mensah"></div>
      <div class="form-row">
        <div class="form-field"><label>Reference Number</label><input type="text" id="pRef" value="${escAttr(refVal)}" placeholder="Assigned on save" readonly></div>
        <div class="form-field"><label>Gender</label><select id="pGender"><option value="">- Select -</option><option value="0"${p?.gender===0?" selected":""}>Male</option><option value="1"${p?.gender===1?" selected":""}>Female</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Phone Number</label><input type="tel" id="pPhone" value="${escAttr(p?.phone||"")}" placeholder="e.g. 0244 123 456"></div>
        <div class="form-field"><label>WhatsApp Number</label><input type="tel" id="pWhatsapp" value="${escAttr(p?.whatsapp||"")}" placeholder="e.g. 0244 123 456"></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Email Address</label><input type="email" id="pEmail" value="${escAttr(p?.email||"")}" placeholder="kofi@example.com"></div>
        <div class="form-field"><label>Date of Birth</label><input type="date" id="pBirthdate" value="${escAttr(p?.birthdate||"")}"></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Age Category</label><select id="pAgeCategory"><option value="">- Select -</option><option value="0"${p?.age_category===0?" selected":""}>Child</option><option value="1"${p?.age_category===1?" selected":""}>Teenager</option><option value="2"${p?.age_category===2?" selected":""}>Adult</option><option value="3"${p?.age_category===3?" selected":""}>Senior</option></select></div>
        <div class="form-field"><label>City</label><input type="text" id="pCity" value="${escAttr(p?.city||"")}" placeholder="e.g. Accra"></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Company</label><input type="text" id="pCompany" value="${escAttr(p?.company||"")}" placeholder="e.g. Ghana Revenue Authority"></div>
        <div class="form-field"><label>Profession</label><input type="text" id="pProfession" value="${escAttr(p?.profession||"")}" placeholder="e.g. Teacher"></div>
      </div>
    </div>

    <div class="form-card">
      <div class="form-section-label">Emergency Contact</div>
      <div class="form-row">
        <div class="form-field"><label>Contact Name</label><input type="text" id="pEmergencyName" value="${escAttr(p?.emergency_contact_name||"")}" placeholder="e.g. Ama Mensah"></div>
        <div class="form-field"><label>Relationship</label><input type="text" id="pEmergencyRelation" value="${escAttr(p?.emergency_contact_relation||"")}" placeholder="e.g. Spouse"></div>
      </div>
      <div class="form-field"><label>Contact Phone</label><input type="tel" id="pEmergencyPhone" value="${escAttr(p?.emergency_contact_phone||"")}" placeholder="e.g. 0244 987 654"></div>
    </div>

    <div class="form-card">
      <div class="form-section-label">Medical Notes</div>
      <div class="form-field"><label>Allergies</label><input type="text" id="pAllergies" value="${escAttr(p?.allergies||"")}" placeholder="e.g. Penicillin, Latex"></div>
      <div class="form-field"><label>Notes / Medical History</label><textarea id="pNotes" placeholder="Any relevant medical history…">${escHtml(p?.notes||"")}</textarea></div>
    </div>

    <div class="form-actions">
      <button class="btn-primary" id="submitPatient" style="padding:0.75rem 2rem;border-radius:100px;font-size:0.88rem">Save Patient</button>
      ${viewingPatient?`<button class="btn-ghost" onclick="viewPatient('${escAttr(viewingPatient)}')">Cancel</button>`:""}
    </div>
  </div>`;

  document.getElementById("submitPatient").addEventListener("click",submitPatientForm);
}

document.getElementById("newPatientBtn").addEventListener("click",()=>{viewingPatient=null;openEditPatientPane(null,null);});

// ── Delete patient ────────────────────────────────────────────────────────────
async function deletePatient(ref, name) {
  if (!confirm(`Permanently delete patient ${name} (${ref})?\n\nAll invoices will also be deleted.\nThis cannot be undone.`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/patients`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ reference_number: ref }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("✅ Patient deleted");
      // Clear detail pane and reload list
      document.getElementById("patientsRight").innerHTML = `<div class="right-empty"><div class="empty-icon">👤</div><h3>Select a patient</h3><p>Choose a patient from the list to view their details.</p></div>`;
      viewingPatient = null;
      loadPatients(patientPage, document.getElementById("patientSearch").value.trim());
    } else {
      showToast(data.error || "Failed to delete patient", true);
    }
  } catch {
    showToast("Network error deleting patient", true);
  }
}

async function submitPatientForm(){
  const ref=editingPatient||"";
  const errEl=document.getElementById("patientFormError");
  errEl.style.display="none";
  const btn=document.getElementById("submitPatient");btn.disabled=true;btn.textContent="Saving…";
  document.querySelectorAll("#patientsRight input[type='text'],#patientsRight input[type='email']").forEach(el=>{el.value=el.value.toUpperCase();});
  const body={
    reference_number:ref,
    name:document.getElementById("pName").value.trim()||null,
    gender:document.getElementById("pGender").value!==""?parseInt(document.getElementById("pGender").value):null,
    phone:document.getElementById("pPhone").value.trim()||null,
    whatsapp:document.getElementById("pWhatsapp").value.trim()||null,
    email:document.getElementById("pEmail").value.trim()||null,
    birthdate:document.getElementById("pBirthdate").value||null,
    age_category:document.getElementById("pAgeCategory").value!==""?parseInt(document.getElementById("pAgeCategory").value):null,
    city:document.getElementById("pCity").value.trim()||null,
    company:document.getElementById("pCompany").value.trim()||null,
    profession:document.getElementById("pProfession").value.trim()||null,
    emergency_contact_name:document.getElementById("pEmergencyName").value.trim()||null,
    emergency_contact_relation:document.getElementById("pEmergencyRelation").value.trim()||null,
    emergency_contact_phone:document.getElementById("pEmergencyPhone").value.trim()||null,
    allergies:document.getElementById("pAllergies").value.trim()||null,
    notes:document.getElementById("pNotes").value.trim()||null,
  };
  try{
    const res=await fetch(`${API_BASE}/api/patients`,{method:editingPatient?"PUT":"POST",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify(body)});
    const data=await res.json();
    if(res.ok){
      showToast(editingPatient?"✅ Patient updated":"✅ Patient added: "+data.patient.reference_number);
      loadPatients(patientPage,document.getElementById("patientSearch").value);
      const savedRef=editingPatient||data.patient.reference_number;
      viewingPatient=savedRef;viewPatient(savedRef);
    }else{errEl.textContent=data.error||"Failed.";errEl.style.display="block";}
  }catch{errEl.textContent="Network error.";errEl.style.display="block";}
  if(document.getElementById("submitPatient")){document.getElementById("submitPatient").disabled=false;document.getElementById("submitPatient").textContent="Save Patient";}
}

// ── Patient search & refresh ──
let ptSearchTimer;
document.getElementById("patientSearch").addEventListener("input",()=>{
  clearTimeout(ptSearchTimer);ptSearchTimer=setTimeout(()=>loadPatients(1,document.getElementById("patientSearch").value.trim()),400);
});

document.getElementById("refreshPatientsBtn").addEventListener("click",()=>loadPatients(patientPage,document.getElementById("patientSearch").value.trim()));
