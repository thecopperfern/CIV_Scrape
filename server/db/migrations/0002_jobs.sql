CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  exit_code INTEGER,
  error TEXT,
  output_path TEXT,
  prospects_found INTEGER NOT NULL DEFAULT 0,
  enrichments_done INTEGER NOT NULL DEFAULT 0,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  requested_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_jobs_org_created ON jobs(org_id, created_at DESC);
CREATE INDEX idx_jobs_status ON jobs(status);
