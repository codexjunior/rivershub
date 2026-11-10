// ═══════════════════════════════════════════════════════════════
//  LOGIN / LOGOUT
// ═══════════════════════════════════════════════════════════════
const savedPw = localStorage.getItem("rdDashPassword");
if(savedPw){document.getElementById("passwordInput").value=savedPw;attemptLogin();}

document.getElementById("loginBtn").addEventListener("click",attemptLogin);
document.getElementById("passwordInput").addEventListener("keydown",e=>{if(e.key==="Enter")attemptLogin();});

async function attemptLogin(){
  const pw=document.getElementById("passwordInput").value.trim();
  if(!pw)return;
  document.getElementById("loginBtn").textContent="Checking…";
  document.getElementById("loginError").style.display="none";
  try{
    const res=await fetch(`${API_BASE}/api/appointments?token=${API_TOKEN}&password=${encodeURIComponent(pw)}`);
    if(res.ok){
      currentPassword=pw;localStorage.setItem("rdDashPassword",pw);
      const d=await res.json();allAppointments=d.appointments;
      await loadMedicalActs();
      document.getElementById("loginScreen").style.display="none";
      const app=document.getElementById("app");app.style.display="flex";app.style.flexDirection="column";
      renderAll();
    }else{document.getElementById("loginError").style.display="block";document.getElementById("loginBtn").textContent="Access Dashboard";}
  }catch{
    document.getElementById("loginError").textContent="Could not connect. Please try again.";
    document.getElementById("loginError").style.display="block";
    document.getElementById("loginBtn").textContent="Access Dashboard";
  }
}
function doLogout(){
  localStorage.removeItem("rdDashPassword");currentPassword="";allAppointments=[];
  document.getElementById("passwordInput").value="";
  document.getElementById("app").style.display="none";
  document.getElementById("loginScreen").style.display="flex";
}
document.getElementById("logoutBtn").addEventListener("click",doLogout);
document.getElementById("drawerLogout").addEventListener("click",doLogout);