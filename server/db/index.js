const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_PATH = process.env.APP_DB_PATH || path.join(DATA_DIR, "app.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

function tx(fn) {
  return db.transaction(fn);
}

function prepare(sql) {
  return db.prepare(sql);
}

module.exports = {
  db,
  tx,
  prepare,
  DB_PATH
};
