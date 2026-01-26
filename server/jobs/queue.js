const fs = require("fs");
const path = require("path");
const store = require("./store");
const { runScript } = require("./runner");

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

function coerceParams(params) {
  const safe = { ...params };
  if (safe.limit !== undefined && safe.limit !== "") {
    safe.limit = Number(safe.limit);
  }
  if (safe.radius !== undefined && safe.radius !== "") {
    safe.radius = Number(safe.radius);
  }
  if (safe.batchSize !== undefined && safe.batchSize !== "") {
    safe.batchSize = Number(safe.batchSize);
  }
  if (typeof safe.dryRun === "string") {
    safe.dryRun = safe.dryRun.toLowerCase() === "true";
  } else {
    safe.dryRun = Boolean(safe.dryRun);
  }
  return safe;
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

  const actionDef = ACTIONS[job.action];
  if (!actionDef) {
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

  const args = actionDef.buildArgs(coerceParams(job.params));
  const result = await runScript({
    script: actionDef.script,
    args,
    logPath: outputPath
  });

  store.updateJob(job.id, {
    status: result.code === 0 ? "completed" : "failed",
    finishedAt: new Date().toISOString(),
    exitCode: result.code,
    error: result.error || (result.code === 0 ? null : "Job failed")
  });

  isRunning = false;
  processNext();
}

function enqueueJob({ action, params, requestedBy }) {
  const job = store.createJob({ action, params, requestedBy });
  pendingQueue.push(job.id);
  processNext();
  return job;
}

function initQueue() {
  const jobs = store.getAllJobs();
  const updated = jobs.map((job) => {
    if (job.status === "running") {
      return {
        ...job,
        status: "failed",
        error: "Server restarted before completion",
        finishedAt: new Date().toISOString()
      };
    }
    return job;
  });

  store.writeJobs(updated);
  pendingQueue = updated.filter((job) => job.status === "queued").map((job) => job.id);
  if (pendingQueue.length > 0) {
    processNext();
  }
}

function getJobOutput(jobId) {
  const job = store.getJob(jobId);
  if (!job || !job.outputPath) return null;
  if (!fs.existsSync(job.outputPath)) return null;
  return fs.readFileSync(job.outputPath, "utf8");
}

module.exports = {
  enqueueJob,
  initQueue,
  listJobs: store.listJobs,
  getJob: store.getJob,
  getJobOutput
};
