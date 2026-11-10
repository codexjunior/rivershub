// ── helpers ──
function escHtml(s){if(!s)return"";return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
function escAttr(s){if(!s)return"";return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/\n/g,"&#10;").replace(/\r/g,"")}
const genderLabel = v => v===0?"Male":v===1?"Female":null;
const ageCatLabel = v => v===0?"Child":v===1?"Teenager":v===2?"Adult":v===3?"Senior":null;
const dateLabel   = v => v?new Date(v).toLocaleDateString("en-GH",{day:"2-digit",month:"short",year:"2-digit",timeZone:"Africa/Accra"}):null;

function showToast(msg,isError=false){
  const t=document.getElementById("toast");
  t.textContent=msg;t.className="toast"+(isError?" error":"");
  t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3500);
}
function getAccraToday(){return new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Accra"})}
