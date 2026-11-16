// ── Resizable split pane (phone layout only) ────────────
// Pointer Events (mouse + touch + pen in one path). The list expands from 0% to 100%
// of the split area. When dragged up, left pane takes full height and hides right pane.
(function() {
  const handle = document.getElementById('splitDragHandle');
  const leftPane = handle && handle.previousElementSibling;
  const rightPane = handle && handle.nextElementSibling;
  const split = leftPane && leftPane.parentElement;
  if (!handle || !leftPane || !rightPane || !split) return;

  const MOBILE = window.matchMedia('(max-width: 860px)');
  const MIN_H = 0;  /* Allow dragging all the way up */
  let dragging = false, startY = 0, startH = 0;

  const maxH = () => split.getBoundingClientRect().height;  /* Allow full height */

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
    /* Hide right pane when left pane takes up most of the space */
    rightPane.style.display = h > (maxH() * 0.7) ? 'none' : 'block';
  });
  const stop = e => {
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);

  MOBILE.addEventListener('change', e => {
    if (!e.matches) {
      leftPane.style.height = '';
      rightPane.style.display = 'block';
    }
  });
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
  // Trigger page initializers (acts, reminders, etc.)
  if(window.pageInitializers && window.pageInitializers[pageId]){
    window.pageInitializers[pageId]();
  }
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
