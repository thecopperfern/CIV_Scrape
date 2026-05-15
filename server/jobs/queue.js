const fs = require("fs");
const store = require("./store");
const { runScript } = require("./runner");
const { NODE_ACTIONS } = require("./nodeActions");
const integrations = require("../integrations/smartsuite");
const usage = require("../billing/usage");
const credits = require("../billing/credits");
const plans = require("../billing/plans");
const { prepare } = require("../db");

let pendingQueue = [];
let isRunning = false;

const ACTIONS = {
  "import-customers": {
    script: "import_customers.py",
    buildArgs: (params) => {
      const args = [];
      if (params.dryRun) args.push("--dry-run");
      if (params.limit) args.push("--limit", String(params.limit));
      if (params.batchSize) args.push("--batch-size", String(params.batchSize));
      return args;
    }
  },
  "sync-customers": {
    script: "sync_customers.py",
    buildArgs: (params) => {
      const args = [];
      if (params.dryRun) args.push("--dry-run");
      if (params.limit) args.push("--limit", String(params.limit));
      return args;
    }
  },
  "find-prospects": {
    script: "find_prospects_geographic.py",
    buildArgs: (params) => {
      const args = [];
      if (params.dryRun) args.push("--dry-run");
      if (params.limit) args.push("--limit", String(params.limit));
      if (params.zipcode) args.push("--zipcode", String(params.zipcode));
      if (params.radius) args.push("--radius", String(params.radius));
      if (params.categories) args.push("--categories", String(params.categories));
      return args;
    }
  },
  "research-prospects": {
    script: "research_prospects.py",
    buildArgs: (params) => {
      const args = [];
      if (params.dryRun) args.push("--dry-run");
      if (params.limit) args.push("--limit", String(params.limit));
      if (params.status) args.push("--status", String(params.status));
      return args;
    }
  },
  "test-integration": {
    script: "test_integration.py",
    buildArgs: () => ["--verbose"]
  }
};

function getAction(name) {
  return ACTIONS[name] || null;
}

function isNodeAction(name) {
  return Boolean(NODE_ACTIONS[name]);
}

function actionKnown(name) {
  return Boolean(getAction(name) || isNodeAction(name));
}

function coerceParams(params) {
  const safe = { ...params };
  if (safe.limit !== undefined && safe.limit !== "") safe.limit = Number(safe.limit);
  if (safe.radius !== undefined && safe.radius !== "") safe.radius = Number(safe.radius);
  if (safe.batchSize !== undefined && safe.batchSize !== "") safe.batchSize = Number(safe.batchSize);
  if (typeof safe.dryRun === "string") safe.dryRun = safe.dryRun.toLowerCase() === "true";
  else safe.dryRun = Boolean(safe.dryRun);
  return safe;
}

function buildEnv(orgId) {
  const env = { PF_ORG_ID: String(orgId) };
  const creds = integrations.getOrgSmartSuiteCreds(orgId);
  if (creds) {
    if (creds.apiKey) env.PF_SMARTSUITE_API_KEY = creds.apiKey;
    if (creds.accountId) env.PF_SMARTSUITE_ACCOUNT_ID = creds.accountId;
    if (creds.sourceTableId) env.PF_SOURCE_TABLE_ID = creds.sourceTableId;
    if (creds.destTableId) env.PF_DEST_TABLE_ID = creds.destTableId;
  }
  return env;
}

async function recordJobOutcome(job, result) {
  if (!result.result) return;

  const prospectsFound = Math.max(0, Number(result.result.prospects_found) || 0);
  const enrichmentsDone = Math.max(0, Number(result.result.enrichments_done) || 0);

  const period = new Date().toISOString().slice(0, 7);
  let creditsCharged = 0;

  if (prospectsFound > 0) {
    usage.recordUsage({
      orgId: job.orgId,
      userId: job.userId,
      jobId: job.id,
      kind: "prospect_found",
      qty: prospectsFound,
      period
    });
  }

  if (enrichmentsDone > 0) {
    const org = prepare("SELECT * FROM orgs WHERE id = ?").get(job.orgId);
    const planFeatures = plans.featuresFor(org?.plan || "free");
    const usedBefore =
      usage.getMonthlyUsage(job.orgId, period).enrichmentsUsed || 0;
    const within = Math.max(0, planFeatures.enrichments - usedBefore);
    const debit = Math.max(0, enrichmentsDone - within);

    usage.recordUsage({
      orgId: job.orgId,
      userId: job.userId,
      jobId: job.id,
      kind: "enrichment",
      qty: enrichmentsDone,
      period
    });

    if (debit > 0) {
      try {
        credits.debitCredits({ orgId: job.orgId, qty: debit, jobId: job.id });
        creditsCharged = debit;
      } catch (err) {
        console.warn(`[queue] credit debit failed for job ${job.id}: ${err.message}`);
      }
    }
  }

  store.updateJob(job.id, {
    prospectsFound,
    enrichmentsDone,
    creditsCharged
  });
}

async function processNext() {
  if (isRunning) return;
  const nextId = pendingQueue.shift();
  if (!nextId) return;

  const job = store.getJob(nextId);
  if (!job) {
    processNext();
    return;
  }

  const actionDef = getAction(job.action);
  const nodeAction = NODE_ACTIONS[job.action];
  if (!actionDef && !nodeAction) {
    store.updateJob(nextId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: `Unknown action: ${job.action}`,
      exitCode: -1
    });
    processNext();
    return;
  }

  isRunning = true;
  const outputPath = store.getLogPath(job.id);
  store.updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    outputPath
  });

  let result;
  if (nodeAction) {
    result = await nodeAction({
      orgId: job.orgId,
      params: coerceParams(job.params),
      logPath: outputPath
    });
  } else {
    const args = actionDef.buildArgs(coerceParams(job.params));
    const env = buildEnv(job.orgId);
    result = await runScript({
      script: actionDef.script,
      args,
      logPath: outputPath,
      env
    });
  }

  if (result.code === 0) {
    await recordJobOutcome(job, result);
  }

  store.updateJob(job.id, {
    status: result.code === 0 ? "completed" : "failed",
    finishedAt: new Date().toISOString(),
    exitCode: result.code,
    error: result.error || (result.code === 0 ? null : "Job failed")
  });

  isRunning = false;
  processNext();
}

function enqueueJob({ orgId, userId, action, params, requestedBy }) {
  if (!orgId) throw new Error("orgId required");
  if (!action) throw new Error("action required");
  if (!actionKnown(action)) throw new Error(`Unknown action: ${action}`);
  const job = store.createJob({ orgId, userId, action, params, requestedBy });
  pendingQueue.push(job.id);
  setImmediate(processNext);
  return job;
}

function initQueue() {
  store.markRunningJobsFailed("Server restarted before completion");
  pendingQueue = store.getQueuedJobIds();
  if (pendingQueue.length > 0) {
    setImmediate(processNext);
  }
}

function getJobOutput(jobId, orgId) {
  const job = store.getJob(jobId, orgId);
  if (!job || !job.outputPath) return null;
  if (!fs.existsSync(job.outputPath)) return null;
  return fs.readFileSync(job.outputPath, "utf8");
}

module.exports = {
  enqueueJob,
  initQueue,
  listJobs: store.listJobs,
  getJob: store.getJob,
  getJobOutput,
  ACTIONS,
  NODE_ACTIONS,
  actionKnown
};
