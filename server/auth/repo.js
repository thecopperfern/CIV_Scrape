const { db, prepare, tx } = require("../db");

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "workspace";
}

function uniqueSlug(base) {
  const stmt = prepare("SELECT 1 FROM orgs WHERE slug = ?");
  let slug = base;
  let i = 1;
  while (stmt.get(slug)) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

function findUserByEmail(email) {
  return prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase());
}

function findUserById(id) {
  return prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function createUser({ email, passwordHash, name }) {
  const result = prepare(
    "INSERT INTO users(email, password_hash, name) VALUES (?, ?, ?)"
  ).run(String(email).toLowerCase(), passwordHash, name || null);
  return findUserById(result.lastInsertRowid);
}

function findOrgById(id) {
  return prepare("SELECT * FROM orgs WHERE id = ?").get(id);
}

function createOrg({ name, plan }) {
  const slug = uniqueSlug(slugify(name));
  const result = prepare(
    "INSERT INTO orgs(name, slug, plan) VALUES (?, ?, ?)"
  ).run(name, slug, plan || "free");
  return findOrgById(result.lastInsertRowid);
}

function addMember({ orgId, userId, role }) {
  prepare(
    "INSERT OR IGNORE INTO org_members(org_id, user_id, role) VALUES (?, ?, ?)"
  ).run(orgId, userId, role || "member");
}

function listOrgsForUser(userId) {
  return prepare(
    `SELECT o.*, m.role
     FROM orgs o
     JOIN org_members m ON m.org_id = o.id
     WHERE m.user_id = ?
     ORDER BY o.created_at ASC`
  ).all(userId);
}

function getMembership(orgId, userId) {
  return prepare(
    "SELECT * FROM org_members WHERE org_id = ? AND user_id = ?"
  ).get(orgId, userId);
}

function countOrgMembers(orgId) {
  const row = prepare(
    "SELECT COUNT(*) AS n FROM org_members WHERE org_id = ?"
  ).get(orgId);
  return row?.n || 0;
}

const signupTx = tx(({ email, passwordHash, name, orgName }) => {
  const user = createUser({ email, passwordHash, name });
  const org = createOrg({ name: orgName || `${name || email}'s workspace`, plan: "free" });
  addMember({ orgId: org.id, userId: user.id, role: "owner" });
  return { user, org };
});

function signup({ email, passwordHash, name, orgName }) {
  return signupTx({ email, passwordHash, name, orgName });
}

function getActiveOrg({ userId, orgId }) {
  if (orgId) {
    const membership = getMembership(orgId, userId);
    if (membership) return findOrgById(orgId);
  }
  const orgs = listOrgsForUser(userId);
  return orgs[0] || null;
}

function updateUserPassword(userId, passwordHash) {
  prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  prepare(
    "INSERT INTO password_reset_tokens(token_hash, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(tokenHash, userId, expiresAt);
}

function consumePasswordResetToken(tokenHash) {
  const row = prepare(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')"
  ).get(tokenHash);
  if (!row) return null;
  prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE token_hash = ?").run(
    tokenHash
  );
  return row;
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  createOrg,
  findOrgById,
  addMember,
  listOrgsForUser,
  getMembership,
  countOrgMembers,
  signup,
  getActiveOrg,
  updateUserPassword,
  createPasswordResetToken,
  consumePasswordResetToken
};
