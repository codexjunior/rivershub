// ── Email invoice ─────────────────────────────────────────────
async function invEmail() {
  // Get email from the patient record already loaded in the detail pane
  const ref = document.getElementById("invoicePatientRef").value;
  let toEmail = null;

  // Try to get patient email from the database
  if (ref) {
    try {
      const res = await fetch(`${API_BASE}/api/patients?ref=${encodeURIComponent(ref)}`, { headers: authHeader() });
      const data = await res.json();
      toEmail = data.patient?.email || null;
    } catch { /* fall through to prompt */ }
  }

  // If no email on file, ask staff to enter one
  if (!toEmail) {
    toEmail = prompt("No email on file for this patient.\nEnter email address to send invoice to:");
    if (!toEmail || !toEmail.includes("@")) {
      if (toEmail !== null) showToast("Please enter a valid email address", true);
      return;
    }
  } else {
    // Confirm with staff before sending
    const confirmed = confirm(`Send invoice to ${toEmail}?\n(This is the email address on file for this patient)`);
    if (!confirmed) return;
  }

  // Reuse the same HTML that invPrint() builds
  const pName    = document.getElementById("invPatientName").value;
  const invNum   = document.getElementById("invNumber").value || "-";
  const date     = document.getElementById("invDate").value;
  const dateStr  = date ? new Date(date).toLocaleDateString("en-GH", { day:"numeric", month:"long", year:"numeric" }) : "";
  const discAmt  = parseFloat(document.getElementById("invDiscountAmt").value) || 0;
  // FIX: Use invPaymentNow (current payment) instead of invAmountPaid (cumulative)
  const amtPaid  = parseFloat(document.getElementById("invPaymentNow")?.value) || 0;
  const priorPaid = parseFloat(document.getElementById("invPriorPaid")?.value) || 0;

  let rowsHtml = ""; let totalMed = 0;
  document.querySelectorAll("[id^='invrow-']").forEach(row => {
    const rid  = row.id.replace("invrow-", "");
    const proc = document.getElementById(`invact-${rid}`)?.value || "";
    const qty  = parseFloat(document.getElementById(`invqty-${rid}`)?.value) || 0;
    const up   = parseFloat(document.getElementById(`invup-${rid}`)?.value)  || 0;
    const tp   = qty * up; totalMed += tp;
    if (proc) rowsHtml += `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escHtml(proc)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${qty}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">GHS ${up.toFixed(2)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">GHS ${tp.toFixed(2)}</td></tr>`;
  });

  const grand = Math.max(0, totalMed - discAmt);
  const rem   = grand - amtPaid;
  const isPaid = rem <= 0.005;

  const invoiceHtml = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#1A2B3C;max-width:600px;margin:0 auto;padding:24px">
  <table width="100%" style="margin-bottom:24px">
    <tr>
      <td>
        <div style="font-size:22px;font-weight:700;color:#0A3A63"><a style="text-decoration:none;" href="https://riversdentalclinic.vercel.app">Rivers Dental Clinic</a></div>
        <div style="font-size:12px;color:#6B7A8D">riversdentalghana&#64;gmail.com &nbsp;·&nbsp; 0302 448742<br>Tantra Street, Taifa, Accra, Ghana</div>
      </td>
      <td style="text-align:right">
        <div style="font-size:16px;font-weight:700;color:#0A3A63">${escHtml(pName.toUpperCase())}</div>
        <div style="font-size:12px;color:#6B7A8D">Invoice No: <strong>${escHtml(invNum)}</strong></div>
        <div style="font-size:12px;color:#6B7A8D">${dateStr}</div>
      </td>
    </tr>
  </table>
  <hr style="border:none;border-top:2px solid #00A9A5;margin-bottom:20px">
  <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
    <thead>
      <tr style="background:#0A3A63;color:white">
        <th style="padding:8px;text-align:left">Procedure</th>
        <th style="padding:8px;text-align:right">Qty</th>
        <th style="padding:8px;text-align:right">Unit Price</th>
        <th style="padding:8px;text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <table width="100%" style="margin-bottom:20px">
    <tr>
      <td width="50%" valign="top">
        <div style="font-weight:700;margin-bottom:8px;color:#0A3A63">Summary</div>
        <table style="font-size:13px;width:100%">
          <tr><td>Total Medical Acts</td><td style="text-align:right">GHS ${totalMed.toFixed(2)}</td></tr>
          <tr><td>Discount</td><td style="text-align:right">GHS ${discAmt.toFixed(2)}</td></tr>
          <tr style="font-weight:700;font-size:15px;color:#0A3A63"><td>Grand Total</td><td style="text-align:right">GHS ${grand.toFixed(2)}</td></tr>
        </table>
      </td>
      <td width="10%"></td>
      <td width="40%" valign="top">
        <div style="font-weight:700;margin-bottom:8px;color:#0A3A63">Payment</div>
        <table style="font-size:13px;width:100%">
          <tr><td>Amount Paid</td><td style="text-align:right">GHS ${amtPaid.toFixed(2)}</td></tr>
          ${priorPaid > 0.005 ? `<tr><td style="font-size:12px;color:#6B7A8D">Previously Paid</td><td style="text-align:right;font-size:12px;color:#6B7A8D">GHS ${priorPaid.toFixed(2)}</td></tr>` : ''}
          <tr style="font-weight:700;color:${isPaid ? "#0B6B4A" : "#C0392B"}"><td>Remaining</td><td style="text-align:right">GHS ${rem.toFixed(2)}</td></tr>
        </table>
        ${isPaid ? `<div style="margin-top:10px;display:inline-block;background:#E8F8F2;border:1.5px solid #0B6B4A;border-radius:4px;padding:3px 10px;font-size:11px;font-weight:700;color:#0B6B4A;text-transform:uppercase">✓ PAID IN FULL</div>` : ""}
      </td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <div style="font-size:11px;color:#6B7A8D;text-align:center">
    <a style="text-decoration:none;" href="https://riversdentalclinic.vercel.app">Rivers Dental Clinic</a> &nbsp;·&nbsp; Tantra Street, Taifa, Accra &nbsp;·&nbsp; Thank you for choosing us
  </div>
</body></html>`;

  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

  try {
    const res = await fetch(`${API_BASE}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({
        action: "email",
        to: toEmail,
        invoiceNumber: invNum,
        patientName: pName,
        invoiceHtml,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`✅ Invoice emailed to ${toEmail}`);
    } else {
      showToast(data.error || "Failed to send email", true);
    }
  } catch {
    showToast("Network error sending email", true);
  }

  if (btn) { btn.disabled = false; btn.textContent = "Email"; }
}