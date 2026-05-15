const { prepare } = require("../db");
const { encryptJson, decryptJson } = require("../crypto/secrets");

const PROVIDER = "twilio";

function envFallbackCreds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return null;
  return { accountSid: sid, authToken: token, fromNumber: from, platformManaged: true };
}

function hintFor(creds) {
  if (!creds) return null;
  return JSON.stringify({
    accountSid: creds.accountSid ? `${String(creds.accountSid).slice(0, 6)}…` : null,
    fromNumber: creds.fromNumber || null
  });
}

function getOrgTwilioCreds(orgId) {
  const row = prepare(
    "SELECT config_encrypted FROM org_integrations WHERE org_id = ? AND provider = ?"
  ).get(orgId, PROVIDER);

  if (row && row.config_encrypted) {
    try {
      return { ...decryptJson(row.config_encrypted), platformManaged: false };
    } catch (err) {
      console.error(`[twilio] decrypt failed for org ${orgId}: ${err.message}`);
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

function setOrgTwilioCreds(orgId, creds) {
  const cleaned = {
    accountSid: String(creds.accountSid || "").trim(),
    authToken: String(creds.authToken || "").trim(),
    fromNumber: String(creds.fromNumber || "").trim()
  };
  if (!cleaned.accountSid || !cleaned.authToken || !cleaned.fromNumber) {
    throw new Error("accountSid, authToken and fromNumber are required");
  }
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

function deleteOrgTwilio(orgId) {
  prepare("DELETE FROM org_integrations WHERE org_id = ? AND provider = ?").run(orgId, PROVIDER);
}

module.exports = {
  PROVIDER,
  getOrgTwilioCreds,
  getOrgIntegrationStatus,
  setOrgTwilioCreds,
  deleteOrgTwilio,
  envFallbackCreds
};
