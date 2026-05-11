const { authRequest } = require("./_auth");
/**
 * /api/acts.js
 * GET    /api/acts?token=&password=            — fetch all active acts
 * POST   /api/acts  { token, password, name, price }   — add new act
 * PUT    /api/acts  { token, password, id, name, price } — update act
 * DELETE /api/acts  { token, password, id }            — deactivate act
 */

const { createClient } = require("@supabase/supabase-js");

// Module-level singleton — created once, reused across all requests
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabase;
}

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://rivershub.vercel.app", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = getSupabase();

  if (req.method === "GET") {
    if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });
    const { data, error } = await supabase
      .from("medical_acts")
      .select("id, name, price")
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ acts: data });
  }

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }
  if (!authRequest(req)) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "POST") {
    const name = (body.name || "").trim().toUpperCase();
    const price = parseFloat(body.price) || 0;
    if (!name) return res.status(400).json({ error: "name is required" });
    const { data, error } = await supabase
      .from("medical_acts").insert({ name, price }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, act: data });
  }

  if (req.method === "PUT") {
    if (!body.id) return res.status(400).json({ error: "id is required" });
    const name = (body.name || "").trim().toUpperCase();
    const price = parseFloat(body.price) || 0;
    const { data, error } = await supabase
      .from("medical_acts").update({ name, price }).eq("id", body.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, act: data });
  }

  if (req.method === "DELETE") {
    if (!body.id) return res.status(400).json({ error: "id is required" });
    // Soft delete — set active = false so historical invoices still reference the name
    const { error } = await supabase
      .from("medical_acts").update({ active: false }).eq("id", body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
