#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const ROOT_DIR = path.resolve(__dirname, "..");
const JOBS_FILE = path.join(ROOT_DIR, "data", "jobs.json");

if (!fs.existsSync(JOBS_FILE)) {
  console.log("[migrate-jobs] no data/jobs.json — nothing to migrate");
  process.exit(0);
}

const { run: runMigrations } = require("../server/db/migrate");
runMigrations();

const { prepare } = require("../server/db");

const orgRow = prepare("SELECT id FROM orgs WHERE id = 1").get();
if (!orgRow) {
  console.error("[migrate-jobs] org #1 missing. Run seed_admin_org.js first.");
  process.exit(1);
}

const raw = fs.readFileSync(JOBS_FILE, "utf8");
let jobs = [];
try {
  jobs = JSON.parse(raw);
} catch {
  console.error("[migrate-jobs] data/jobs.json is not valid JSON");
  process.exit(1);
}

const insert = prepare(
  `INSERT OR IGNORE INTO jobs
   (id, org_id, action, params_json, status, exit_code, error, output_path,
    requested_by, created_at, started_at, finished_at, updated_at)
   VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

let inserted = 0;
for (const j of jobs) {
  const result = insert.run(
    j.id,
    j.action,
    JSON.stringify(j.params || {}),
    j.status || "completed",
    j.exitCode ?? null,
    j.error ?? null,
    j.outputPath ?? null,
    j.requestedBy ?? null,
    j.createdAt || new Date().toISOString(),
    j.startedAt ?? null,
    j.finishedAt ?? null,
    j.updatedAt || j.createdAt || new Date().toISOString()
  );
  if (result.changes > 0) inserted += 1;
}

fs.renameSync(JOBS_FILE, JOBS_FILE + ".migrated");
console.log(`[migrate-jobs] migrated ${inserted} job(s); renamed file to jobs.json.migrated`);
