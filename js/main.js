// ═══════════════════════════════════════════════════════════════
//  BOOT - auto-login with the saved password
//  Must stay the LAST <script> in index.html: attemptLogin() calls
//  functions defined in the other files (renderAll, loadMedicalActs, ...).
// ═══════════════════════════════════════════════════════════════
const savedPw = localStorage.getItem("rdDashPassword");
if(savedPw){document.getElementById("passwordInput").value=savedPw;attemptLogin();}
