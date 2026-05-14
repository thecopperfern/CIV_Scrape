const crypto = require("crypto");
const { prepare } = require("../db");

const PREFIX = "pf_live_";

function generateKey() {
  const random = crypto.randomBytes(24).toString("base64url");
  const full = `${PREFIX}${random}`;
  const hash = crypto.createHash("sha256").update(full).digest("hex");
  const prefix = full.slice(0, 12);
  return { full, prefix, hash };
}

function hashKey(full) {
  return crypto.createHash("sha256").update(String(full)).digest("hex");
}

function listKeys(orgId) {
  return prepare(
    "SELECT id, name, prefix, last_used_at, created_at, revoked_at FROM api_keys WHERE org_id = ? ORDER BY created_at DESC"
  ).all(orgId);
}

function createKey({ orgId, userId, name }) {
  const { full, prefix, hash } = generateKey();
  const result = prepare(
    "INSERT INTO api_keys(org_id, user_id, name, prefix, hash) VALUES (?, ?, ?, ?, ?)"
  ).run(orgId, userId || null, name || "API key", prefix, hash);
  return {
    id: result.lastInsertRowid,
    full,
    prefix,
    name: name || "API key"
  };
}

function revokeKey({ orgId, keyId }) {
  prepare(
    "UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND org_id = ? AND revoked_at IS NULL"
  ).run(keyId, orgId);
}

function findActiveByHash(hash) {
  return prepare(
    `SELECT k.*, o.id AS org_id_full, o.name AS org_name, o.plan AS org_plan, o.credits_balance, o.slug, o.stripe_customer_id
     FROM api_keys k
     JOIN orgs o ON o.id = k.org_id
     WHERE k.hash = ? AND k.revoked_at IS NULL`
  ).get(hash);
}

function touchKey(keyId) {
  prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(keyId);
}

module.exports = {
  generateKey,
  hashKey,
  listKeys,
  createKey,
  revokeKey,
  findActiveByHash,
  touchKey
};
