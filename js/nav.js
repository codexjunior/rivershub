// ── Resizable split pane (mobile only) ──────────────────
(function() {
  const handle = document.getElementById('splitDragHandle');
  const leftPane = handle && handle.previousElementSibling;
  if (!handle || !leftPane) return;

  let dragging = false;
  let startY = 0;
  let startH = 0;

  function onStart(e) {
    if (window.innerWidth > 860) return;
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startH = leftPane.getBoundingClientRect().height;
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = y - startY;
    const newH = Math.min(Math.max(startH + delta, 120), window.innerHeight - 200);
    leftPane.style.height = newH + 'px';
    e.preventDefault();
  }

  function onEnd() { dragging = false; }

  handle.addEventListener('mousedown', onStart);
  handle.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
})();

// ═══════════════════════════════════════════════════════════════
//  PAGE NAV
// ═══════════════════════════════════════════════════════════════
function showPage(pageId){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-link,.drawer-link").forEach(b=>b.classList.remove("active"));
  document.getElementById("page-"+pageId)?.classList.add("active");
  const navKey=pageId.startsWith("patient")?"patients":pageId;
  document.querySelectorAll(`[data-page="${navKey}"]`).forEach(b=>b.classList.add("active"));
  closeDrawer();
}
document.querySelectorAll("[data-page]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const p=btn.dataset.page;showPage(p);
    if(p==="patients"&&allPatients.length===0)loadPatients();
  });
});

// ── Drawer ──
function openDrawer(){document.getElementById("drawer").classList.add("open");document.getElementById("drawerOverlay").style.display="block";requestAnimationFrame(()=>document.getElementById("drawerOverlay").classList.add("open"));}
function closeDrawer(){document.getElementById("drawer").classList.remove("open");document.getElementById("drawerOverlay").classList.remove("open");setTimeout(()=>document.getElementById("drawerOverlay").style.display="none",250);}
document.getElementById("hamburger").addEventListener("click",openDrawer);
document.getElementById("drawerClose").addEventListener("click",closeDrawer);
document.getElementById("drawerOverlay").addEventListener("click",closeDrawer);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){document.getElementById("newApptModal").classList.remove("open");document.getElementById("invoiceModal").classList.remove("open");}});
