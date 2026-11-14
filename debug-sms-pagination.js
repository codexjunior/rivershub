// Debug script to paste in browser console
console.log('=== SMS Pagination Debug ===');
console.log('All SMS Patients:', allSMSPatients.length);
console.log('Page size:', SMS_PAGE_SIZE);
console.log('Filter state:', smsFilterState);

// Check what renderSMSPreferencesTable sees
const container=document.getElementById("smsOptOutList");
console.log('Container exists:', !!container);

// Manually call render with logging
const origRender = window.renderSMSPreferencesTable;
window.renderSMSPreferencesTable = function() {
  console.log('→ renderSMSPreferencesTable called');
  console.log('  allSMSPatients.length:', allSMSPatients.length);
  console.log('  currentPage:', smsFilterState.currentPage);
  const result = origRender.call(this);
  console.log('← render complete');
  return result;
};

// Re-render to test
renderSMSPreferencesTable();
