/**
 * Shared auth helper.
 * Accepts credentials from query params (GET) OR request body (POST/PUT/etc)
 * OR Authorization header: "Bearer TOKEN:PASSWORD"
 */
function authRequest(req) {
  // Check Authorization header first (most secure)
  const authHeader = req.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    const [token, password] = authHeader.slice(7).split(":");
    if (token === process.env.DASHBOARD_TOKEN && password === process.env.DASHBOARD_PASSWORD) return true;
  }
  // Fall back to body (POST/PUT/PATCH/DELETE)
  const b = req.body || {};
  if (b.token === process.env.DASHBOARD_TOKEN && b.password === process.env.DASHBOARD_PASSWORD) return true;
  // Fall back to query params (GET — legacy, still supported)
  const q = req.query || {};
  if (q.token === process.env.DASHBOARD_TOKEN && q.password === process.env.DASHBOARD_PASSWORD) return true;
  return false;
}

module.exports = { authRequest };
