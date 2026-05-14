const fs = require("fs");
const path = require("path");
const { db } = require("./index");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function ensureMigrationsTable() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
}

function appliedVersions() {
  const rows = db.prepare("SELECT version FROM schema_migrations").all();
  return new Set(rows.map((r) => r.version));
}

function run() {
  ensureMigrationsTable();
  const applied = appliedVersions();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const insert = db.prepare("INSERT INTO schema_migrations(version) VALUES (?)");

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      insert.run(version);
    });

    try {
      applyMigration();
      console.log(`[migrate] applied ${version}`);
    } catch (err) {
      console.error(`[migrate] failed ${version}:`, err.message);
      throw err;
    }
  }
}

if (require.main === module) {
  run();
  console.log("[migrate] done");
  process.exit(0);
}

module.exports = { run };
