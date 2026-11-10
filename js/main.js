// ═══════════════════════════════════════════════════════════════
//  LOGIN / LOGOUT
// ═══════════════════════════════════════════════════════════════
const savedPw = localStorage.getItem("rdDashPassword");
if(savedPw){document.getElementById("passwordInput").value=savedPw;attemptLogin();}