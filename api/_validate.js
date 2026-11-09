/**
 * Shared input validation helpers
 */

// Strip any keys not in the allowed list from an object
function permit(obj, allowed) {
  const out = {};
  for (const key of allowed) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

// Sanitise a string — trim and cap length
function sanitiseStr(val, maxLen = 500) {
  if (val === null || val === undefined) return null;
  return String(val).trim().slice(0, maxLen) || null;
}

// Validate a patient body — returns { valid, errors, cleaned }
function validatePatient(body) {
  const errors = [];
  const cleaned = {};

  const strField = (key, max = 200) => {
    const v = sanitiseStr(body[key], max);
    cleaned[key] = v;
  };

  // Required
  if (!body.reference_number) errors.push("reference_number is required");
  else cleaned.reference_number = sanitiseStr(body.reference_number, 50);

  // Optional strings
  strField("name", 200);
  strField("phone", 30);
  strField("whatsapp", 30);
  strField("email", 200);
  strField("city", 100);
  strField("company", 200);
  strField("profession", 200);
  strField("emergency_contact_name", 200);
  strField("emergency_contact_relation", 100);
  strField("emergency_contact_phone", 30);
  strField("allergies", 500);
  strField("notes", 2000);
  strField("birthdate", 20);

  // Integer fields
  if (body.gender !== null && body.gender !== undefined) {
    const g = parseInt(body.gender);
    if (![0, 1].includes(g)) errors.push("gender must be 0 (Male) or 1 (Female)");
    else cleaned.gender = g;
  }
  if (body.age_category !== null && body.age_category !== undefined) {
    const a = parseInt(body.age_category);
    if (![0, 1, 2, 3].includes(a)) errors.push("age_category must be 0-3");
    else cleaned.age_category = a;
  }

  return { valid: errors.length === 0, errors, cleaned };
}

module.exports = { permit, sanitiseStr, validatePatient };
