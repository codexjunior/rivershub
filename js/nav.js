// ── Resizable split pane (phone layout only) ────────────
// Pointer Events (mouse + touch + pen in one path). The list can grow to 85% of the
// split area, never below 220px. Leaving the phone layout clears the dragged height
// so the desktop 3-column CSS rules again (F15).
(function() {
  const handle = document.getElementById('splitDragHandle');
  const leftPane = handle && handle.previousElementSibling;
  const split = leftPane && leftPane.parentElement;
  if (!handle || !leftPane || !split) return;

  const MOBILE = window.matchMedia('(max-width: 860px)');
  const MIN_H = 220;
  let dragging = false, startY = 0, startH = 0;

  const maxH = () => Math.round(split.getBoundingClientRect().height * 0.85);

  handle.addEventListener('pointerdown', e => {
    if (!MOBILE.matches) return;
    dragging = true;
    startY = e.clientY;
    startH = leftPane.getBoundingClientRect().height;
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const h = Math.min(Math.max(startH + (e.clientY - startY), MIN_H), maxH());
    leftPane.style.height = h + 'px';
  });
  const stop = e => {
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);

  MOBILE.addEventListener('change', e => { if (!e.matches) leftPane.style.height = ''; });
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
