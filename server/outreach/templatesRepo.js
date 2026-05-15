const { prepare } = require("../db");

function rowToTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    name: row.name,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    variantLabel: row.variant_label,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listTemplates({ orgId, channel, includeArchived = false } = {}) {
  const where = ["org_id = ?"];
  const params = [orgId];
  if (channel) {
    where.push("channel = ?");
    params.push(channel);
  }
  if (!includeArchived) where.push("archived_at IS NULL");
  return prepare(
    `SELECT * FROM templates WHERE ${where.join(" AND ")} ORDER BY updated_at DESC`
  ).all(...params).map(rowToTemplate);
}

function getTemplate(id, orgId) {
  const row = prepare("SELECT * FROM templates WHERE id = ? AND org_id = ?").get(id, orgId);
  return rowToTemplate(row);
}

function createTemplate({ orgId, userId, name, channel, subject, body, variantLabel }) {
  const res = prepare(
    `INSERT INTO templates(org_id, user_id, name, channel, subject, body, variant_label)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(orgId, userId || null, name, channel, subject || null, body, variantLabel || null);
  return getTemplate(res.lastInsertRowid, orgId);
}

function updateTemplate(id, orgId, patch) {
  const allowed = [
    ["name", "name"],
    ["channel", "channel"],
    ["subject", "subject"],
    ["body", "body"],
    ["variant_label", "variantLabel"],
    ["archived_at", "archivedAt"]
  ];
  const sets = [];
  const values = [];
  for (const [col, key] of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      sets.push(`${col} = ?`);
      values.push(patch[key]);
    }
  }
  if (sets.length === 0) return getTemplate(id, orgId);
  sets.push("updated_at = datetime('now')");
  values.push(id, orgId);
  prepare(`UPDATE templates SET ${sets.join(", ")} WHERE id = ? AND org_id = ?`).run(...values);
  return getTemplate(id, orgId);
}

function deleteTemplate(id, orgId) {
  prepare("DELETE FROM templates WHERE id = ? AND org_id = ?").run(id, orgId);
}

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
