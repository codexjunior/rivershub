// ── Print invoice (clean A4 with PAID stamp + watermark) ───────
function invPrint(){
  const pName=document.getElementById("invPatientName").value;
  const invNum=document.getElementById("invNumber").value||"-";
  const date=document.getElementById("invDate").value;
  const dateStr=date?new Date(date).toLocaleDateString("en-GH",{day:"numeric",month:"long",year:"numeric"}):"";
  const discAmt=parseFloat(document.getElementById("invDiscountAmt").value)||0;
  const amtPaid=parseFloat(document.getElementById("invAmountPaid").value)||0;

  // Collect rows
  let rowsHtml="";let totalMed=0;
  document.querySelectorAll("[id^='invrow-']").forEach(row=>{
    const rid=row.id.replace("invrow-","");
    const proc=document.getElementById(`invact-${rid}`)?.value||"";
    const qty=parseFloat(document.getElementById(`invqty-${rid}`)?.value)||0;
    const up=parseFloat(document.getElementById(`invup-${rid}`)?.value)||0;
    const tp=qty*up;totalMed+=tp;
    if(proc)rowsHtml+=`<tr><td>${escHtml(proc)}</td><td>${qty}</td><td style="text-align:right">GHS ${up.toFixed(2)}</td><td style="text-align:right">GHS ${tp.toFixed(2)}</td><td style="text-align:right">GHS ${tp.toFixed(2)}</td></tr>`;
  });
  const grand=Math.max(0,totalMed-discAmt);const rem=grand-amtPaid;
  const isFullyPaid=rem<=0.005;

  // Watermark logo - centered, 30% opacity
  const watermark=`
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      width:380pt;height:380pt;z-index:0;pointer-events:none;display:flex;align-items:center;justify-content:center;">
      <img src="/imgs/rivers_dental_logo.png"
        style="width:100%;height:100%;object-fit:contain;opacity:0.18;" alt="">
    </div>`;

  document.getElementById("printInvoiceArea").innerHTML=`
  <div class="print-inv-wrap" style="position:relative;overflow:hidden;">
    ${watermark}
    <div style="position:relative;z-index:2;">
    <div class="print-inv-header">
      <div>
        <div class="print-inv-clinic-name">Rivers Dental Clinic</div>
        <span class="print-inv-clinic-sub">Your Health is Our Priority</span>
        <div class="print-inv-contact">riversdentalghana&#64;gmail.com<br>0302 448742<br>Tantra Street, Taifa, Accra, Ghana</div>
      </div>
      <div class="print-inv-meta">
        <div class="print-inv-patient">${escHtml(pName.toUpperCase())}</div>
        <div class="print-inv-numbox">
          <div class="print-inv-num-label">Invoice No.</div>
          <div class="print-inv-num-val">${escHtml(invNum)}</div>
        </div>
        <div class="print-inv-date">${dateStr}</div>
      </div>
    </div>
    <div class="print-sec-title">Medical Acts</div>
    <table class="print-acts-table">
      <thead><tr><th>Procedure</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th><th style="text-align:right">Patient Share</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="print-totals-grid">
      <div>
        <div class="print-sec-title">Summary</div>
        <table class="print-totals-table">
          <tr><td>Total medical acts</td><td>GHS ${totalMed.toFixed(2)}</td></tr>
          <tr><td>Discount</td><td>GHS ${discAmt.toFixed(2)}</td></tr>
          <tr><td>Grand Total</td><td>GHS ${grand.toFixed(2)}</td></tr>
        </table>
      </div>
      <div>
        <div class="print-sec-title">Payment</div>
        <table class="print-payment-table">
          <tr><td>Amount Paid (GHS)</td><td>GHS ${amtPaid.toFixed(2)}</td></tr>
          <tr><td>Remaining Balance</td><td style="font-weight:700;color:${isFullyPaid?"#0B6B4A":"#C0392B"}">GHS ${rem.toFixed(2)}</td></tr>
        </table>
      </div>
    </div>
    ${isFullyPaid?`<div style="margin-top:12pt;text-align:right;"><span style="display:inline-block;background:#E8F8F2;border:1.5pt solid #0B6B4A;border-radius:4pt;padding:3pt 10pt;font-size:8pt;font-weight:700;color:#0B6B4A;letter-spacing:0.1em;text-transform:uppercase;">✓ PAID</span></div>`:""}
    </div><!-- end z-index wrapper -->
    <div class="print-footer">
      <span>Rivers Dental Clinic &nbsp;·&nbsp; Tantra Street, Taifa, Accra</span>
      <span>Thank you for choosing Rivers Dental Clinic</span>
    </div>
  </div>`;
    const logoImg = new Image();
  let printed = false;
  const doPrint = () => { if (!printed) { printed = true; window.print(); } };
  logoImg.onload = doPrint;
  logoImg.onerror = doPrint;
  logoImg.src = "/imgs/rivers_dental_logo.png";
  if (logoImg.complete) doPrint();
  setTimeout(doPrint, 1500);
}
