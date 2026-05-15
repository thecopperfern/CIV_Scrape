const cron = require("node-cron");
const { prepare } = require("../db");
const { enqueueJob } = require("../jobs/queue");

let task = null;
const recentlyEnqueued = new Map();

function findOrgsWithDueTargets() {
  const rows = prepare(
    `SELECT DISTINCT org_id FROM campaign_targets
     WHERE status = 'active' AND next_send_at IS NOT NULL AND next_send_at <= datetime('now')`
  ).all();
  return rows.map((r) => r.org_id);
}

function tick() {
  let orgIds;
  try {
    orgIds = findOrgsWithDueTargets();
  } catch (err) {
    console.warn(`[outreach-scheduler] tick failed: ${err.message}`);
    return;
  }
  const now = Date.now();
  for (const orgId of orgIds) {
    const last = recentlyEnqueued.get(orgId) || 0;
    if (now - last < 30_000) continue;
    try {
      enqueueJob({
        orgId,
        action: "send-campaign-batch",
        params: { batchSize: 25 },
        requestedBy: "scheduler"
      });
      recentlyEnqueued.set(orgId, now);
    } catch (err) {
      console.warn(`[outreach-scheduler] enqueue failed org=${orgId}: ${err.message}`);
    }
  }
  // Garbage-collect debounce map
  for (const [k, v] of recentlyEnqueued.entries()) {
    if (now - v > 5 * 60_000) recentlyEnqueued.delete(k);
  }
}

function start() {
  if (task) return;
  if (process.env.OUTREACH_SCHEDULER_ENABLED !== "true") {
    console.log("[outreach-scheduler] disabled (set OUTREACH_SCHEDULER_ENABLED=true to enable)");
    return;
  }
  task = cron.schedule("* * * * *", tick, { scheduled: true });
  console.log("[outreach-scheduler] started (every 1 min)");
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop, tick };
