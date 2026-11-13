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
let allAppointments = [];
let currentPassword = "";
let currentPage = 1;

