// ═══════════════════════════════════════════════════════════════
//  APPOINTMENTS
// ═══════════════════════════════════════════════════════════════
document.getElementById("refreshBtn").addEventListener("click",async()=>{
  document.getElementById("refreshBtn").textContent="…";
  try{const r=await fetch(`${API_BASE}/api/appointments`,{headers:authHeader()});const d=await r.json();allAppointments=d.appointments;renderAll();}catch{}
  document.getElementById("refreshBtn").textContent="↻";
});
document.getElementById("searchInput").addEventListener("input",()=>{currentPage=1;renderAll();});

// New Appointment Modal
const newApptModal=document.getElementById("newApptModal");
document.getElementById("newApptBtn").addEventListener("click",()=>{
  ["apptName","apptPhone","apptEmail","apptDate","apptTime","apptDuration","apptDescription"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("apptFormError").style.display="none";newApptModal.classList.add("open");
});
document.getElementById("closeNewAppt").addEventListener("click",()=>newApptModal.classList.remove("open"));
newApptModal.addEventListener("click",e=>{if(e.target===newApptModal)newApptModal.classList.remove("open");});

document.getElementById("submitNewAppt").addEventListener("click",async()=>{
  const name=document.getElementById("apptName").value.trim();
  const phone=document.getElementById("apptPhone").value.trim();
  const email=document.getElementById("apptEmail").value.trim();
  const date=document.getElementById("apptDate").value;
  const time=document.getElementById("apptTime").value;
  const desc=document.getElementById("apptDescription").value.trim();
  const errEl=document.getElementById("apptFormError");
  if(!name){errEl.textContent="Patient name is required.";errEl.style.display="block";return;}
  if(!phone){errEl.textContent="Phone number is required.";errEl.style.display="block";return;}
  if(!date){errEl.textContent="Please select a date.";errEl.style.display="block";return;}
  if(!time){errEl.textContent="Please select a time.";errEl.style.display="block";return;}
  errEl.style.display="none";
  const btn=document.getElementById("submitNewAppt");btn.disabled=true;btn.textContent="Creating…";
  try{
    const duration=document.getElementById("apptDuration").value.trim();
    const res=await fetch(`${API_BASE}/api/manage`,{method:"POST",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify({name,phone,email,date,time,duration,description:desc})});
    const data=await res.json();
    if(res.ok&&data.success){newApptModal.classList.remove("open");showToast("✅ Appointment created");const r2=await fetch(`${API_BASE}/api/appointments`,{headers:authHeader()});const d2=await r2.json();allAppointments=d2.appointments;renderAll();}
    else{errEl.textContent=data.error||"Failed.";errEl.style.display="block";}
  }catch{errEl.textContent="Network error.";errEl.style.display="block";}
  btn.disabled=false;btn.textContent="Create Appointment";
});

// Edit notes delegation
document.getElementById("apptContent").addEventListener("click",async function(e){
  const card=e.target.closest(".appt-card");if(!card)return;
  const eventId=card.dataset.id;const appt=allAppointments.find(a=>a.id===eventId);
  if(e.target.closest(".edit-btn")){
    card.querySelector(".notes-display").style.display="none";
    card.querySelector(".edit-area").style.display="block";
    card.querySelector(".edit-textarea").value=appt?.notes||"";
    card.querySelector(".edit-textarea").focus();return;
  }
  if(e.target.closest(".cancel-edit-btn")){
    card.querySelector(".notes-display").style.display="block";
    card.querySelector(".edit-area").style.display="none";
    const notes=appt?.notes||"";
    card.querySelector(".notes-display").innerHTML=notes.trim()?`<div class="appt-notes">${escHtml(notes)}</div>`:`<div class="appt-no-notes">No notes</div>`;return;
  }
  if(e.target.closest(".save-btn")){
    const sb=card.querySelector(".save-btn");const newNotes=card.querySelector(".edit-textarea").value.trim();
    sb.textContent="Saving…";sb.disabled=true;
    try{
      const res=await fetch(`${API_BASE}/api/manage`,{method:"PUT",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify({eventId,description:newNotes})});
      const data=await res.json();
      if(res.ok&&data.success){
        if(appt)appt.notes=newNotes;
        card.querySelector(".edit-area").style.display="none";
        const nd=card.querySelector(".notes-display");nd.style.display="block";
        nd.innerHTML=newNotes?`<div class="appt-notes">${escHtml(newNotes)}</div>`:`<div class="appt-no-notes">No notes</div>`;
        showToast("✅ Notes updated");
      }else{showToast("Failed to save",true);sb.textContent="Save";sb.disabled=false;}
    }catch{showToast("Network error",true);sb.textContent="Save";sb.disabled=false;}
  }
});

function renderAll(){
  const search=document.getElementById("searchInput").value.toLowerCase().trim();
  const filtered=search?allAppointments.filter(a=>a.title.toLowerCase().includes(search)):allAppointments;
  const todayStr=getAccraToday();
  const weekEnd=new Date(new Date(todayStr+"T00:00:00").getTime()+7*86400000);
  document.getElementById("statTotal").textContent=allAppointments.length;
  document.getElementById("statToday").textContent=allAppointments.filter(a=>a.dateRaw.startsWith(todayStr)).length;
  document.getElementById("statWeek").textContent=allAppointments.filter(a=>new Date(a.dateRaw)<=weekEnd).length;
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  if(currentPage>totalPages)currentPage=1;
  const paginated=filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  document.getElementById("resultCount").textContent=search?`${filtered.length} result${filtered.length!==1?"s":""}`:`${filtered.length} appt${filtered.length!==1?"s":""}`;
  if(filtered.length===0){document.getElementById("apptContent").innerHTML=`<div class="state-msg"><div class="icon">🦷</div><p>${search?"No appointments found.":"No upcoming appointments."}</p></div>`;return;}
  const byDate={};paginated.forEach(a=>{const k=a.dateRaw.split("T")[0];if(!byDate[k])byDate[k]=[];byDate[k].push(a);});
  const allByDate={};filtered.forEach(a=>{const k=a.dateRaw.split("T")[0];allByDate[k]=(allByDate[k]||0)+1;});
  let html="";
  Object.entries(byDate).forEach(([dk,appts])=>{
    const isT=dk===todayStr;const cnt=allByDate[dk]||appts.length;const lbl=isT?`Today - ${appts[0].date}`:appts[0].date;
    html+=`<div class="date-group-header">${lbl}<span class="day-count">${cnt} appt${cnt!==1?"s":""}</span></div><div class="appt-list">`;
    appts.forEach(a=>{
        const tr=a.time;      
        const src=a.isWebBooking?`<span class="source-badge web">Website</span>`:`<span class="source-badge manual">Manual</span>`;
      const notesH=(a.notes||"").trim()?`<div class="appt-notes">${escHtml(a.notes)}</div>`:`<div class="appt-no-notes">No notes</div>`;
      const hasDet=a.patient||a.phone||a.email||a.service;
      const det=hasDet?`<div class="appt-details">
        ${a.patient?`<div class="appt-detail"><span class="detail-label">Patient</span><span class="detail-value">${escHtml(a.patient)}</span></div>`:""}
        ${a.service?`<div class="appt-detail"><span class="detail-label">Service</span><span class="detail-value service-badge">${escHtml(a.service)}</span></div>`:""}
        ${a.phone?`<div class="appt-detail"><span class="detail-label">Phone</span><span class="detail-value"><a href="tel:${a.phone.replace(/\s/g,"")}">${escHtml(a.phone)}</a></span></div>`:""}
        ${a.email?`<div class="appt-detail"><span class="detail-label">Email</span><span class="detail-value"><a href="mailto:${escHtml(a.email)}">${escHtml(a.email)}</a></span></div>`:""}
      </div>`:"";
      html+=`<div class="appt-card${isT?" today-card":""}" id="card-${a.id}" data-id="${a.id}">
        <div class="appt-top"><span class="appt-time${isT?" today-time":""}">${tr}</span><div><div class="appt-title">${escHtml(a.title)}</div>${src}</div></div>
        ${det}
        <div class="notes-display">${notesH}</div>
        <div class="edit-area" style="display:none"><textarea class="edit-textarea" placeholder="Add notes…"></textarea><div style="display:flex;gap:0.4rem;margin-top:0.4rem"><button class="save-btn">Save</button><button class="cancel-edit-btn">Cancel</button></div></div>
        <div class="appt-card-actions">
          ${(a.phone) ? `<button class="remind-btn" onclick="event.stopPropagation();sendManualReminder('${escAttr(a.id)}','${escAttr(a.phone)}','${escAttr(a.patient||a.title)}','${escAttr(a.dateRaw)}','${escAttr(a.time||'')}')">Remind</button>` : ""}
          <button class="edit-btn">Edit Notes</button>
        </div>      
      </div>`;
    });
    html+=`</div>`;
  });
  if(totalPages>1){
    html+=`<div class="pagination"><button class="page-btn" onclick="changePage(${currentPage-1})" ${currentPage===1?"disabled":""}>← Prev</button>`;
    for(let i=1;i<=totalPages;i++){if(i===1||i===totalPages||Math.abs(i-currentPage)<=1)html+=`<button class="page-btn${i===currentPage?" active":""}" onclick="changePage(${i})">${i}</button>`;else if(Math.abs(i-currentPage)===2)html+=`<span class="page-ellipsis">…</span>`;}
    html+=`<button class="page-btn" onclick="changePage(${currentPage+1})" ${currentPage===totalPages?"disabled":""}>Next →</button></div>`;
  }
  document.getElementById("apptContent").innerHTML=html;
}
function changePage(p){
  const s=document.getElementById("searchInput").value.toLowerCase().trim();
  const f=s?allAppointments.filter(a=>a.title.toLowerCase().includes(s)):allAppointments;
  const tot=Math.ceil(f.length/PAGE_SIZE);
  if(p<1||p>tot)return;currentPage=p;renderAll();
  document.getElementById("apptContent").scrollIntoView({behavior:"smooth",block:"start"});
}

async function sendManualReminder(eventId, phone, patientName, dateRaw, timeStr){
  const apptDate = new Date(dateRaw).toLocaleDateString("en-GH",{
    weekday:"long", day:"numeric", month:"long", year:"numeric", timeZone:"Africa/Accra",
  });
  const displayTime = timeStr || new Date(dateRaw).toLocaleTimeString("en-GH",{
    hour:"2-digit", minute:"2-digit", hour12:true, timeZone:"Africa/Accra",
  });
  const message =
    `Hello ${patientName}, this is a reminder that your appointment is scheduled for ${apptDate} at ${displayTime}.` +
    `Please call 030 244 8742 if you would like to reschedule. Thank you!`;

  if(!confirm(`Send SMS reminder?\n\nTo: ${patientName} (${phone})\n\nMessage:\n"${message}"`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (res.ok) showToast(`✅ Reminder sent to ${patientName}`);
    else showToast(data.error || "Failed to send reminder", true);
  } catch {
    showToast("Network error sending reminder", true);
  }
}