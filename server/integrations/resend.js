const { prepare } = require("../db");
const { encryptJson, decryptJson } = require("../crypto/secrets");

const PROVIDER = "resend";

function envFallbackCreds() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL || null,
    fromName: process.env.RESEND_FROM_NAME || null,
    platformManaged: true
  };
}

function hintFor(creds) {
  if (!creds) return null;
  const last4 = String(creds.apiKey || "").slice(-4);
  return JSON.stringify({
    apiKeyLast4: last4 ? `…${last4}` : null,
    fromEmail: creds.fromEmail || null,
    fromName: creds.fromName || null
  });
}

function getOrgResendCreds(orgId) {
  const row = prepare(
    "SELECT config_encrypted FROM org_integrations WHERE org_id = ? AND provider = ?"
  ).get(orgId, PROVIDER);

  if (row && row.config_encrypted) {
    try {
      return { ...decryptJson(row.config_encrypted), platformManaged: false };
    } catch (err) {
      console.error(`[resend] decrypt failed for org ${orgId}: ${err.message}`);
    }
  }
  return null;
}

function getOrgIntegrationStatus(orgId) {
  const row = prepare(
    "SELECT config_hint, updated_at FROM org_integrations WHERE org_id = ? AND provider = ?"
  ).get(orgId, PROVIDER);

  if (row) {
    let hint = null;
    try {
      hint = JSON.parse(row.config_hint || "null");
    } catch {}
    return { configured: true, hint, updatedAt: row.updated_at, source: "byo" };
  }
  if (envFallbackCreds()) {
    return { configured: true, hint: null, updatedAt: null, source: "platform" };
  }
  return { configured: false, hint: null, updatedAt: null, source: null };
}

function setOrgResendCreds(orgId, creds) {
  const cleaned = {
    apiKey: String(creds.apiKey || "").trim(),
    fromEmail: creds.fromEmail ? String(creds.fromEmail).trim() : null,
    fromName: creds.fromName ? String(creds.fromName).trim() : null
  };
  if (!cleaned.apiKey) throw new Error("apiKey is required");
  const encrypted = encryptJson(cleaned);
  prepare(
    `INSERT INTO org_integrations(org_id, provider, config_encrypted, config_hint)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(org_id, provider) DO UPDATE SET
       config_encrypted = excluded.config_encrypted,
       config_hint = excluded.config_hint,
       updated_at = datetime('now')`
  ).run(orgId, PROVIDER, encrypted, hintFor(cleaned));
  return getOrgIntegrationStatus(orgId);
}

function deleteOrgResend(orgId) {
  prepare("DELETE FROM org_integrations WHERE org_id = ? AND provider = ?").run(orgId, PROVIDER);
}

module.exports = {
  PROVIDER,
  getOrgResendCreds,
  getOrgIntegrationStatus,
  setOrgResendCreds,
  deleteOrgResend,
  envFallbackCreds
};
