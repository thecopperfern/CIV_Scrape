CREATE TABLE usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  job_id TEXT REFERENCES jobs(id),
  kind TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  period TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_usage_org_period_kind ON usage_events(org_id, period, kind);
