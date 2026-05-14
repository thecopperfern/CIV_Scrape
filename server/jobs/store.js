const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");
const { db, prepare } = require("../db");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const LOG_DIR = path.join(ROOT_DIR, "logs", "jobs");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureLogDir() {
  ensureDir(LOG_DIR);
}

function rowToJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    action: row.action,
    params: safeParse(row.params_json),
    status: row.status,
    exitCode: row.exit_code,
    error: row.error,
    outputPath: row.output_path,
    prospectsFound: row.prospects_found,
    enrichmentsDone: row.enrichments_done,
    creditsCharged: row.credits_charged,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at
  };
}

function safeParse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

function createJob({ orgId, userId, action, params, requestedBy }) {
  const id = nanoid(10);
  const stmt = prepare(
    `INSERT INTO jobs(id, org_id, user_id, action, params_json, status, requested_by)
     VALUES (?, ?, ?, ?, ?, 'queued', ?)`
  );
  stmt.run(id, orgId, userId || null, action, JSON.stringify(params || {}), requestedBy || null);
  return getJobInternal(id);
}

function updateJob(jobId, patch) {
  const allowed = [
    ["status", "status"],
    ["exit_code", "exitCode"],
    ["error", "error"],
    ["output_path", "outputPath"],
    ["started_at", "startedAt"],
    ["finished_at", "finishedAt"],
    ["prospects_found", "prospectsFound"],
    ["enrichments_done", "enrichmentsDone"],
    ["credits_charged", "creditsCharged"]
  ];
  const sets = [];
  const values = [];
  for (const [col, key] of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      sets.push(`${col} = ?`);
      values.push(patch[key]);
    }
  }
  if (sets.length === 0) return getJobInternal(jobId);
  sets.push("updated_at = datetime('now')");
  values.push(jobId);
  prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getJobInternal(jobId);
}

function getJobInternal(jobId) {
  const row = prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  return rowToJob(row);
}

function getJob(jobId, orgId) {
  if (orgId == null) return getJobInternal(jobId);
  const row = prepare("SELECT * FROM jobs WHERE id = ? AND org_id = ?").get(jobId, orgId);
  return rowToJob(row);
}

function listJobs({ orgId, status, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (orgId != null) {
    where.push("org_id = ?");
    params.push(orgId);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = prepare(`SELECT COUNT(*) AS n FROM jobs ${whereSql}`).get(...params).n;
  const rows = prepare(
    `SELECT * FROM jobs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, Math.min(limit, 200), offset);
  return {
    items: rows.map(rowToJob),
    total,
    limit,
    offset
  };
}

function getQueuedJobIds() {
  const rows = prepare("SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at ASC").all();
  return rows.map((r) => r.id);
}

function markRunningJobsFailed(reason) {
  prepare(
    "UPDATE jobs SET status = 'failed', error = ?, finished_at = datetime('now'), updated_at = datetime('now') WHERE status = 'running'"
  ).run(reason);
}

function getLogPath(jobId) {
  ensureLogDir();
  return path.join(LOG_DIR, `${jobId}.log`);
}

module.exports = {
  createJob,
  updateJob,
  getJob,
  listJobs,
  getQueuedJobIds,
  markRunningJobsFailed,
  getLogPath
};
