const { prepare } = require("../db");
const plans = require("./plans");

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function recordUsage({ orgId, userId, jobId, kind, qty, period }) {
  if (!orgId || !kind) throw new Error("orgId and kind required");
  prepare(
    `INSERT INTO usage_events(org_id, user_id, job_id, kind, qty, period)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(orgId, userId || null, jobId || null, kind, qty || 1, period || currentPeriod());
}

function getMonthlyUsage(orgId, period) {
  const p = period || currentPeriod();
  const rows = prepare(
    `SELECT kind, COALESCE(SUM(qty), 0) AS total
     FROM usage_events
     WHERE org_id = ? AND period = ?
     GROUP BY kind`
  ).all(orgId, p);
  const out = { prospectsUsed: 0, enrichmentsUsed: 0 };
  for (const r of rows) {
    if (r.kind === "prospect_found") out.prospectsUsed = r.total;
    if (r.kind === "enrichment") out.enrichmentsUsed = r.total;
  }
  return out;
}

function getQuotaState(orgId) {
  const org = prepare("SELECT * FROM orgs WHERE id = ?").get(orgId);
  if (!org) return null;
  const features = plans.featuresFor(org.plan);
  const used = getMonthlyUsage(orgId);
  return {
    plan: org.plan,
    period: currentPeriod(),
    prospects: { used: used.prospectsUsed, limit: features.prospects },
    enrichments: { used: used.enrichmentsUsed, limit: features.enrichments },
    credits: org.credits_balance,
    seats: features.seats,
    api: features.api
  };
}

module.exports = {
  recordUsage,
  getMonthlyUsage,
  getQuotaState,
  currentPeriod
};
