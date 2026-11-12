// ═════════════════════════════════════════════════════════════════
//  INVOICE MODAL LOGIC
// ════════════════════════════════════════════════════════════════
let invRowCount=0;

function buildActOptions(sel){
  return`<option value="">Select procedure</option>`+ACTS.map(a=>`<option value="${escHtml(a)}"${a===sel?" selected":""}>${escHtml(a)}</option>`).join("");
}

function invAddActRow(procedure="",qty=1,unitPrice=""){
  invRowCount++;const id=invRowCount;
  const tbody=document.getElementById("invActsBody");
  const tr=document.createElement("tr");tr.id=`invrow-${id}`;
  tr.innerHTML=`
    <td class="im-c-proc"><select id="invact-${id}" aria-label="Procedure" onchange="invOnActSelect(${id})">${buildActOptions(procedure)}</select></td>
    <td class="im-c-qty" data-label="Qty"><input type="number" id="invqty-${id}" aria-label="Quantity" value="${qty}" min="1" step="1" inputmode="numeric" oninput="invRecalcRow(${id})"></td>
    <td class="im-c-price" data-label="Unit price (GHS)"><input type="number" id="invup-${id}" aria-label="Unit price" value="${unitPrice}" min="0" step="0.01" inputmode="decimal" placeholder="0.00" oninput="invMarkManual(${id});invRecalcRow(${id})"></td>
    <td class="im-c-amt" data-label="Amount (GHS)"><span class="im-amount" id="invtp-${id}">0.00</span><span id="invps-${id}" hidden>0.00</span></td>
    <td class="im-c-x"><button type="button" class="im-remove" onclick="invDeleteRow(${id})" aria-label="Remove this act" title="Remove"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></td>`;
  tbody.appendChild(tr);
  if(procedure&&unitPrice!=="")invRecalcRow(id);
  else if(procedure)invOnActSelect(id);
  invUpdateActCount();
}
function invMarkManual(id){const el=document.getElementById(`invup-${id}`);if(el)el.dataset.manual="1";}
function invOnActSelect(id){
  const sel=document.getElementById(`invact-${id}`);const upEl=document.getElementById(`invup-${id}`);
  if(!sel||!upEl)return;
  const price=ACT_PRICES[sel.value];
  if(price!==undefined&&!upEl.dataset.manual)upEl.value=price.toFixed(2);
  invRecalcRow(id);
}
function invRecalcRow(id){
  const qty=parseFloat(document.getElementById(`invqty-${id}`)?.value)||0;
  const up=parseFloat(document.getElementById(`invup-${id}`)?.value)||0;
  const tp=qty*up;
  const tpEl=document.getElementById(`invtp-${id}`);const psEl=document.getElementById(`invps-${id}`);
  if(tpEl)tpEl.textContent=tp.toFixed(2);if(psEl)psEl.textContent=tp.toFixed(2);
  invRecalcTotals();
}
function invDeleteRow(id){document.getElementById(`invrow-${id}`)?.remove();invRecalcTotals();invUpdateActCount();}
function invUpdateActCount(){
  const c=document.querySelectorAll("[id^='invrow-']").length;
  document.getElementById("invActCount").textContent=`${c} item${c!==1?"s":""}`;
  const hint=document.getElementById("invEmptyHint");if(hint)hint.hidden=c>0;
  const tbl=document.querySelector(".im-table");if(tbl)tbl.hidden=c===0;
}

// ── Recalculate totals: reads from visible Amount Paid field, keeps hidden invAmountPaid in sync ──
function invRecalcTotals(){
  let tot=0;document.querySelectorAll("[id^='invtp-']").forEach(el=>{tot+=parseFloat(el.textContent)||0;});
  const dAmt=Math.min(parseFloat(document.getElementById("invDiscountAmt")?.value)||0, tot);
  const grand=tot-dAmt;
  // User types into invPaymentNow (visible). invPriorPaid holds already-recorded paid amount.
  const paidNow=parseFloat(document.getElementById("invPaymentNow")?.value)||0;
  const paidPrior=parseFloat(document.getElementById("invPriorPaid")?.value)||0;
  const paid=paidNow+paidPrior;
  document.getElementById("invAmountPaid").value=paid.toFixed(2);   // hidden field used by save/print/email
  const rem=grand-paid;
  document.getElementById("invTotMedActs").textContent=`GHS ${tot.toFixed(2)}`;
  document.getElementById("invTotGrand").textContent=`GHS ${grand.toFixed(2)}`;
  // state: empty (nothing billed) | due | paid | over. Label and colour both change, so state never relies on colour alone.
  let state="due",label="Balance due",shown=rem;
  if(grand<=0.005)      {state="empty";label="Balance";shown=0;}
  else if(rem<-0.005)   {state="over";label="Overpaid by";shown=-rem;}
  else if(rem<=0.005)   {state="paid";label="Paid in full";shown=0;}
  document.getElementById("invRemaining").textContent=`GHS ${shown.toFixed(2)}`;
  document.getElementById("invBalanceLabel").textContent=label;
  document.getElementById("imBalance").dataset.state=state;
}

// ── Mark as paid in full: fills visible amount paid field, triggers recalc ──
function invPayFull(){
  let tot=0;document.querySelectorAll("[id^='invtp-']").forEach(el=>{tot+=parseFloat(el.textContent)||0;});
  const dAmt=Math.min(parseFloat(document.getElementById("invDiscountAmt")?.value)||0, tot);
  const grand=tot-dAmt;
  document.getElementById("invPaymentNow").value=grand.toFixed(2);
  invRecalcTotals();

  // Toggle checkmark icon to filled state
  const btn = document.getElementById("imPayFull");
  if (btn) {
    btn.classList.add("paid");
    btn.querySelector(".check-icon-outline")?.style.setProperty("display", "none");
    btn.querySelector(".check-icon-filled")?.style.setProperty("display", "block");
  }
}

function invUpdateHeader(){
  const num=document.getElementById("invNumber").value.trim();
  const date=document.getElementById("invDate").value;
  document.getElementById("invNumberDisplay").textContent=num||"-";
  if(date){const d=new Date(date);document.getElementById("invDateDisplay").textContent=d.toLocaleDateString("en-GH",{weekday:"long",day:"numeric",month:"long",year:"numeric"});}
  else document.getElementById("invDateDisplay").textContent="";
}

// OPEN INVOICE MODAL - also accepts existing invoice for editing
function openInvoiceModal(ref, patientName, invoiceNumber, existingInv){
  document.getElementById("invoicePatientRef").value=ref;
  document.getElementById("editingInvoiceId").value=existingInv?existingInv.id:"";
  const displayName=patientName||ref;
  document.getElementById("invPatientName").value=displayName;
  document.getElementById("invPatientDisplay").textContent=displayName.toUpperCase();
  // Invoice number = patient reference (as requested)
  const invNum=existingInv?.invoice_number||invoiceNumber||ref;
  document.getElementById("invNumber").value=invNum;
  document.getElementById("invDate").value=existingInv?existingInv.date:new Date().toISOString().split("T")[0];
  document.getElementById("invDiscountAmt").value=existingInv?existingInv.discount_amount||0:0;

  // ── Robustly load amount_paid from existing invoice into invPriorPaid ──
  let loadedPaid = 0;
  if (existingInv) {
    if (typeof existingInv.amount_paid === "number") loadedPaid = existingInv.amount_paid;
    else if (typeof existingInv.amount_paid === "string") loadedPaid = parseFloat(existingInv.amount_paid) || 0;
    else if (typeof existingInv.grand_total === "number" && typeof existingInv.amount_remaining === "number") {
      loadedPaid = existingInv.grand_total - existingInv.amount_remaining;
    } else if (typeof existingInv.grand_total === "string" && typeof existingInv.amount_remaining === "string") {
      loadedPaid = (parseFloat(existingInv.grand_total) || 0) - (parseFloat(existingInv.amount_remaining) || 0);
    }
  }
  // Show already-paid in the "Paid before" row
  document.getElementById("invPaidBefore").textContent=`GHS ${loadedPaid.toFixed(2)}`;
  document.getElementById("invPriorPaid").value=loadedPaid.toFixed(2);
  // User-facing amount paid field starts empty (new payment to add); prior paid is tracked separately
  document.getElementById("invPaymentNow").value="0";

  document.getElementById("invActsBody").innerHTML="";invRowCount=0;
  if(existingInv&&existingInv.invoice_items&&existingInv.invoice_items.length>0){
    existingInv.invoice_items.forEach(it=>invAddActRow(it.procedure,it.qty,it.unit_price));
  }else{invAddActRow();}
  document.getElementById("submitInvoice").textContent=existingInv?"Update Invoice":"Save Invoice";
  document.getElementById("imTitle").textContent=existingInv?"Edit invoice":"New invoice";
  invUpdateHeader();invRecalcTotals();invUpdateActCount();
  document.getElementById("invoiceModal").classList.add("open");
}

// ── Event listeners ──
document.getElementById("addActBtn").addEventListener("click",()=>{
  invAddActRow();
  const sels=document.querySelectorAll("#invActsBody select");sels[sels.length-1]?.focus();
});
document.getElementById("imPayFull").addEventListener("click",invPayFull);
document.getElementById("imClose").addEventListener("click",()=>document.getElementById("invoiceModal").classList.remove("open"));
document.getElementById("invoiceModal").addEventListener("click",e=>{if(e.target===document.getElementById("invoiceModal"))document.getElementById("invoiceModal").classList.remove("open");});
document.getElementById("submitInvoice").addEventListener("click",async()=>{
  const ref=document.getElementById("invoicePatientRef").value;
  const date=document.getElementById("invDate").value;
  const editId=document.getElementById("editingInvoiceId").value;
  const btn=document.getElementById("submitInvoice");
  if(!date){showToast("Please select a date",true);return;}
  const items=[];
  document.querySelectorAll("[id^='invrow-']").forEach(row=>{
    const rid=row.id.replace("invrow-","");
    const proc=document.getElementById(`invact-${rid}`)?.value;
    const qty=parseFloat(document.getElementById(`invqty-${rid}`)?.value)||0;
    const up=parseFloat(document.getElementById(`invup-${rid}`)?.value)||0;
    const tp=parseFloat(document.getElementById(`invtp-${rid}`)?.textContent)||0;
    const ps=parseFloat(document.getElementById(`invps-${rid}`)?.textContent)||0;
    if(proc)items.push({procedure:proc,qty,unit_price:up,total_price:tp,patient_share:ps});
  });
  if(items.length===0){showToast("Add at least one medical act",true);return;}

  const discAmt=parseFloat(document.getElementById("invDiscountAmt").value)||0;
  const amtPaid=parseFloat(document.getElementById("invAmountPaid").value)||0;
  const totalMed=items.reduce((s,i)=>s+i.total_price,0);
  const grandTotal=Math.max(0,totalMed-discAmt);
  const remaining=grandTotal-amtPaid;
  const payload={
    reference_number:ref,
    invoice_number:document.getElementById("invNumber").value.trim()||null,
    date,discount_pct:0,discount_amount:discAmt,subtotal:totalMed,
    grand_total:grandTotal,amount_paid:amtPaid,amount_remaining:remaining,
    paid:remaining<=0.005,items,
  };
  btn.disabled=true;btn.textContent="Saving…";
  try{
    let res;
    if(editId){
      res=await fetch(`${API_BASE}/api/invoices`,{method:"PATCH",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify({...payload,id:editId})});
    }else{
      res=await fetch(`${API_BASE}/api/invoices`,{method:"POST",headers:{"Content-Type":"application/json",...authHeader()},body:JSON.stringify(payload)});
    }
    const data=await res.json();
    if(res.ok){
      document.getElementById("invoiceModal").classList.remove("open");
      showToast(editId?"✅ Invoice updated":"✅ Invoice saved");
      refreshInvoiceList();
    }else showToast(data.error||"Failed",true);
  }catch{showToast("Network error",true);}
  btn.disabled=false;btn.textContent=editId?"Update Invoice":"Save Invoice";
});
