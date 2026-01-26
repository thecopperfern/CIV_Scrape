const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const LOG_DIR = path.join(ROOT_DIR, "logs", "jobs");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureStore() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(JOBS_FILE)) {
    fs.writeFileSync(JOBS_FILE, "[]", "utf8");
  }
}

function ensureLogDir() {
  ensureDir(LOG_DIR);
}

function readJobs() {
  ensureStore();
  try {
    const raw = fs.readFileSync(JOBS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function writeJobs(jobs) {
  ensureStore();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), "utf8");
}

function createJob({ action, params, requestedBy }) {
  const jobs = readJobs();
  const job = {
    id: nanoid(10),
    action,
    params: params || {},
    status: "queued",
    requestedBy: requestedBy || "admin",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    outputPath: null,
    error: null,
    updatedAt: new Date().toISOString()
  };

  jobs.unshift(job);
  writeJobs(jobs);
  return job;
}

function updateJob(jobId, patch) {
  const jobs = readJobs();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) {
    return null;
  }

  jobs[index] = {
    ...jobs[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };

  writeJobs(jobs);
  return jobs[index];
}

function getJob(jobId) {
  const jobs = readJobs();
  return jobs.find((job) => job.id === jobId) || null;
}

function listJobs({ status, limit = 50, offset = 0 } = {}) {
  const jobs = readJobs();
  const filtered = status ? jobs.filter((job) => job.status === status) : jobs;
  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit);
  return { items, total, offset, limit };
}

function getAllJobs() {
  return readJobs();
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
  getAllJobs,
  getLogPath,
  writeJobs
};
