// ═══════════════════════════════════════════════════════════════
//  CORE CONFIG
// ═══════════════════════════════════════════════════════════════
const API_TOKEN = "rivers-dental-staff"; // DASHBOARD_TOKEN
const API_BASE  = "";

// Build Authorization header - keeps credentials out of query params and logs
// Uses pipe (|) as separator to allow passwords containing colons
function authHeader() {
  return { "Authorization": `Bearer ${API_TOKEN}|${currentPassword}` };
}
// Build auth query string (kept for login check only - before currentPassword is set)
function authQuery(pw) {
  return `token=${API_TOKEN}&password=${encodeURIComponent(pw || currentPassword)}`;
}
const PAGE_SIZE = 10;
const PATIENT_LIMIT = 20;      // patients per page (API default is 20, max 500)
let allAppointments = [];
let allPatients = [];
let patientTotal = 0;          // total patients matching the current search
let patientPage = 1;           // current page in the patient list
let viewingPatient = null;     // reference number of the patient shown on the right
let editingPatient = null;     // reference number of the patient being edited
let currentPassword = "";
let currentPage = 1;

