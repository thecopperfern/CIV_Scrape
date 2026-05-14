const { prepare } = require("../db");
const { encryptJson, decryptJson } = require("../crypto/secrets");

const PROVIDER = "smartsuite";

function envFallbackCreds() {
  const apiKey = process.env.SMARTSUITE_API_KEY;
  const accountId = process.env.SMARTSUITE_ACCOUNT_ID;
  if (!apiKey || !accountId) return null;
  return {
    apiKey,
    accountId,
    sourceTableId: process.env.SOURCE_CUSTOMERS_TABLE_ID || null,
    destTableId: process.env.DESTINATION_INTELLIGENCE_HUB_TABLE_ID || null
  };
}

function hintFor(creds) {
  if (!creds) return null;
  const last4 = String(creds.apiKey || "").slice(-4);
  return JSON.stringify({
    accountId: creds.accountId,
    apiKeyLast4: last4 ? `…${last4}` : null,
    sourceTableId: creds.sourceTableId || null,
    destTableId: creds.destTableId || null
  });
}

function getOrgSmartSuiteCreds(orgId) {
  const row = prepare(
    "SELECT config_encrypted FROM org_integrations WHERE org_id = ? AND provider = ?"
  ).get(orgId, PROVIDER);

  if (row && row.config_encrypted) {
    try {
      return decryptJson(row.config_encrypted);
    } catch (err) {
      console.error(`[integrations] decrypt failed for org ${orgId}: ${err.message}`);
    }
  }

  if (orgId === 1) {
    return envFallbackCreds();
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
    } catch {
      hint = null;
    }
    return { configured: true, hint, updatedAt: row.updated_at, fallback: false };
  }

  if (orgId === 1 && envFallbackCreds()) {
    return { configured: true, hint: null, updatedAt: null, fallback: true };
  }

  return { configured: false, hint: null, updatedAt: null, fallback: false };
}

function setOrgSmartSuiteCreds(orgId, creds) {
  const cleaned = {
    apiKey: String(creds.apiKey || "").trim(),
    accountId: String(creds.accountId || "").trim(),
    sourceTableId: creds.sourceTableId ? String(creds.sourceTableId).trim() : null,
    destTableId: creds.destTableId ? String(creds.destTableId).trim() : null
  };
  if (!cleaned.apiKey || !cleaned.accountId) {
    throw new Error("apiKey and accountId are required");
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

function deleteOrgSmartSuite(orgId) {
  prepare("DELETE FROM org_integrations WHERE org_id = ? AND provider = ?").run(orgId, PROVIDER);
}

module.exports = {
  getOrgSmartSuiteCreds,
  getOrgIntegrationStatus,
  setOrgSmartSuiteCreds,
  deleteOrgSmartSuite
};
