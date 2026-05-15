CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  subject TEXT,
  body TEXT NOT NULL,
  variant_label TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_templates_org ON templates(org_id, channel);

CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','done','archived')),
  from_name TEXT,
  from_email TEXT,
  reply_to_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX idx_campaigns_org_status ON campaigns(org_id, status);

CREATE TABLE campaign_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','call')),
  day_offset INTEGER NOT NULL DEFAULT 0,
  template_ids_json TEXT NOT NULL DEFAULT '[]',
  send_window_start TEXT,
  send_window_end TEXT,
  send_window_tz TEXT DEFAULT 'America/New_York',
  send_on_weekdays_only INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_campaign_steps_campaign ON campaign_steps(campaign_id, step_order);

CREATE TABLE campaign_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  external_id TEXT,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  custom_fields_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','done','replied','bounced','unsubscribed','failed')),
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TEXT,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE INDEX idx_campaign_targets_org_campaign ON campaign_targets(org_id, campaign_id);
CREATE INDEX idx_campaign_targets_next_send ON campaign_targets(next_send_at);
CREATE INDEX idx_campaign_targets_status ON campaign_targets(status);

CREATE TABLE outreach_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  target_id INTEGER REFERENCES campaign_targets(id) ON DELETE SET NULL,
  step_id INTEGER REFERENCES campaign_steps(id),
  template_id INTEGER REFERENCES templates(id),
  channel TEXT NOT NULL,
  kind TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  provider_event_id TEXT UNIQUE,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outreach_events_org_created ON outreach_events(org_id, created_at DESC);
CREATE INDEX idx_outreach_events_target ON outreach_events(target_id, created_at);
CREATE INDEX idx_outreach_events_campaign_kind ON outreach_events(campaign_id, kind);
CREATE INDEX idx_outreach_events_provider_msg ON outreach_events(provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  target_id INTEGER REFERENCES campaign_targets(id) ON DELETE SET NULL,
  external_id TEXT,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('connected','voicemail','no_answer','wrong_number','bad_number','dnc')),
  duration_seconds INTEGER,
  notes TEXT,
  follow_up_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_call_logs_org_created ON call_logs(org_id, created_at DESC);

CREATE TABLE unsubscribes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  token TEXT UNIQUE,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_unsub_org_email ON unsubscribes(org_id, email);
CREATE INDEX idx_unsub_org_phone ON unsubscribes(org_id, phone);
