const { prepare, tx } = require("../db");

function rowToCampaign(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    name: row.name,
    status: row.status,
    fromName: row.from_name,
    fromEmail: row.from_email,
    replyToEmail: row.reply_to_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    stats: {
      targets: row.target_count || 0,
      sent: row.sent_count || 0,
      delivered: row.delivered_count || 0,
      opened: row.opened_count || 0,
      replied: row.replied_count || 0,
      bounced: row.bounced_count || 0
    }
  };
}

function rowToStep(row) {
  if (!row) return null;
  let templateIds = [];
  try {
    templateIds = JSON.parse(row.template_ids_json || "[]");
  } catch {}
  return {
    id: row.id,
    campaignId: row.campaign_id,
    stepOrder: row.step_order,
    channel: row.channel,
    dayOffset: row.day_offset,
    templateIds,
    sendWindowStart: row.send_window_start,
    sendWindowEnd: row.send_window_end,
    sendWindowTz: row.send_window_tz,
    sendOnWeekdaysOnly: Boolean(row.send_on_weekdays_only)
  };
}

function rowToTarget(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    campaignId: row.campaign_id,
    externalId: row.external_id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    customFields: tryParse(row.custom_fields_json),
    status: row.status,
    currentStep: row.current_step,
    nextSendAt: row.next_send_at,
    enrolledAt: row.enrolled_at,
    finishedAt: row.finished_at
  };
}

function tryParse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

function listCampaigns({ orgId, status, limit = 50, offset = 0 }) {
  const where = ["c.org_id = ?"];
  const params = [orgId];
  if (status) {
    where.push("c.status = ?");
    params.push(status);
  }
  const sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM campaign_targets t WHERE t.campaign_id = c.id) AS target_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'sent') AS sent_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'delivered') AS delivered_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'opened') AS opened_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'replied') AS replied_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'bounced') AS bounced_count
    FROM campaigns c
    WHERE ${where.join(" AND ")}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const rows = prepare(sql).all(...params, Math.min(limit, 200), offset);
  const total = prepare(`SELECT COUNT(*) AS n FROM campaigns c WHERE ${where.join(" AND ")}`).get(...params).n;
  return { items: rows.map(rowToCampaign), total };
}

function getCampaign(id, orgId) {
  const row = prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM campaign_targets t WHERE t.campaign_id = c.id) AS target_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'sent') AS sent_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'delivered') AS delivered_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'opened') AS opened_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'replied') AS replied_count,
      (SELECT COUNT(*) FROM outreach_events e WHERE e.campaign_id = c.id AND e.kind = 'bounced') AS bounced_count
    FROM campaigns c
    WHERE c.id = ? AND c.org_id = ?
  `).get(id, orgId);
  return rowToCampaign(row);
}

function createCampaign({ orgId, userId, name, fromName, fromEmail, replyToEmail }) {
  const res = prepare(
    `INSERT INTO campaigns(org_id, user_id, name, from_name, from_email, reply_to_email)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(orgId, userId || null, name, fromName || null, fromEmail || null, replyToEmail || null);
  return getCampaign(res.lastInsertRowid, orgId);
}

function updateCampaign(id, orgId, patch) {
  const allowed = [
    ["name", "name"],
    ["status", "status"],
    ["from_name", "fromName"],
    ["from_email", "fromEmail"],
    ["reply_to_email", "replyToEmail"],
    ["started_at", "startedAt"],
    ["finished_at", "finishedAt"]
  ];
  const sets = [];
  const values = [];
  for (const [col, key] of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      sets.push(`${col} = ?`);
      values.push(patch[key]);
    }
  }
  if (sets.length === 0) return getCampaign(id, orgId);
  sets.push("updated_at = datetime('now')");
  values.push(id, orgId);
  prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ? AND org_id = ?`).run(...values);
  return getCampaign(id, orgId);
}

function listSteps(campaignId) {
  return prepare(
    "SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order ASC"
  ).all(campaignId).map(rowToStep);
}

const replaceSteps = tx(({ campaignId, steps }) => {
  prepare("DELETE FROM campaign_steps WHERE campaign_id = ?").run(campaignId);
  const ins = prepare(
    `INSERT INTO campaign_steps(campaign_id, step_order, channel, day_offset, template_ids_json,
      send_window_start, send_window_end, send_window_tz, send_on_weekdays_only)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    ins.run(
      campaignId,
      i,
      s.channel,
      Number(s.dayOffset) || 0,
      JSON.stringify(s.templateIds || []),
      s.sendWindowStart || null,
      s.sendWindowEnd || null,
      s.sendWindowTz || "America/New_York",
      s.sendOnWeekdaysOnly === false ? 0 : 1
    );
  }
});

function listTargets({ orgId, campaignId, status, limit = 50, offset = 0 }) {
  const where = ["org_id = ?", "campaign_id = ?"];
  const params = [orgId, campaignId];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  const rows = prepare(
    `SELECT * FROM campaign_targets WHERE ${where.join(" AND ")} ORDER BY enrolled_at DESC LIMIT ? OFFSET ?`
  ).all(...params, Math.min(limit, 200), offset);
  const total = prepare(
    `SELECT COUNT(*) AS n FROM campaign_targets WHERE ${where.join(" AND ")}`
  ).get(...params).n;
  return { items: rows.map(rowToTarget), total };
}

function getTarget(id, orgId) {
  const row = prepare("SELECT * FROM campaign_targets WHERE id = ? AND org_id = ?").get(id, orgId);
  return rowToTarget(row);
}

const insertTargetsTx = tx(({ orgId, campaignId, targets }) => {
  const ins = prepare(
    `INSERT INTO campaign_targets(org_id, campaign_id, external_id, display_name, email, phone, company, custom_fields_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let count = 0;
  for (const t of targets) {
    const customJson = JSON.stringify(t.customFields || t.custom_fields || {});
    ins.run(
      orgId,
      campaignId,
      t.externalId || null,
      t.displayName || t.name || null,
      t.email || null,
      t.phone || null,
      t.company || null,
      customJson
    );
    count += 1;
  }
  return count;
});

function importTargets({ orgId, campaignId, targets }) {
  return insertTargetsTx({ orgId, campaignId, targets });
}

function setTargetNextSend(targetId, orgId, nextSendAt) {
  prepare(
    "UPDATE campaign_targets SET next_send_at = ? WHERE id = ? AND org_id = ?"
  ).run(nextSendAt, targetId, orgId);
}

const startCampaignTx = tx(({ campaignId, orgId, firstSendAt }) => {
  prepare(
    "UPDATE campaigns SET status = 'active', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND org_id = ?"
  ).run(campaignId, orgId);
  prepare(
    "UPDATE campaign_targets SET next_send_at = ?, current_step = 0 WHERE campaign_id = ? AND org_id = ? AND status = 'active'"
  ).run(firstSendAt, campaignId, orgId);
});

function pauseCampaign(campaignId, orgId) {
  prepare(
    "UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ? AND org_id = ?"
  ).run(campaignId, orgId);
  prepare(
    "UPDATE campaign_targets SET next_send_at = NULL WHERE campaign_id = ? AND org_id = ? AND status = 'active'"
  ).run(campaignId, orgId);
}

const resumeCampaignTx = tx(({ campaignId, orgId, nextSendAt }) => {
  prepare(
    "UPDATE campaigns SET status = 'active', updated_at = datetime('now') WHERE id = ? AND org_id = ?"
  ).run(campaignId, orgId);
  prepare(
    "UPDATE campaign_targets SET next_send_at = ? WHERE campaign_id = ? AND org_id = ? AND status = 'active' AND next_send_at IS NULL"
  ).run(nextSendAt, campaignId, orgId);
});

module.exports = {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  listSteps,
  replaceSteps,
  listTargets,
  getTarget,
  importTargets,
  setTargetNextSend,
  startCampaign: startCampaignTx,
  pauseCampaign,
  resumeCampaign: resumeCampaignTx,
  rowToTarget
};
