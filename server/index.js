const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const cors = require("cors");
const dotenv = require("dotenv");

const ROOT_DIR = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT_DIR, ".env") });

const { run: runMigrations } = require("./db/migrate");
runMigrations();

const { enqueueJob, initQueue, listJobs, getJob, getJobOutput, ACTIONS, actionKnown } = require("./jobs/queue");
const { listRecords } = require("./smartsuite");
const integrations = require("./integrations/smartsuite");

const authRoutes = require("./auth/routes");
const apiKeyRoutes = require("./auth/apiKeyRoutes");
const billingRoutes = require("./billing/routes");
const billingWebhook = require("./billing/webhook");
const integrationRoutes = require("./integrations/routes");
const v1Router = require("./api/v1/router");
const templatesRoutes = require("./outreach/templatesRoutes");
const campaignsRoutes = require("./outreach/campaignsRoutes");
const callsRoutes = require("./outreach/callsRoutes");
const resendWebhook = require("./outreach/resendWebhook");
const twilioWebhook = require("./outreach/twilioWebhook");
const unsubscribeRoutes = require("./outreach/unsubscribeRoutes");
const outreachScheduler = require("./outreach/scheduler");

const usage = require("./billing/usage");
const { requireAuth } = require("./middleware/requireAuth");
const { checkQuota } = require("./middleware/checkQuota");

const app = express();
const PORT = process.env.PORT || 3001;
const IS_DEV = process.env.NODE_ENV !== "production";

app.set("trust proxy", 1);

if (IS_DEV) {
  app.use(cors({ origin: "http://localhost:3000", credentials: true }));
}

app.use("/api/webhooks/stripe", billingWebhook);
app.use("/api/webhooks/resend", resendWebhook);
app.use("/api/webhooks/twilio", twilioWebhook);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const SESSIONS_DIR = path.join(ROOT_DIR, "data");
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: SESSIONS_DIR
    }),
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: !IS_DEV,
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/api-keys", apiKeyRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/calls", callsRoutes);
app.use("/u", unsubscribeRoutes);
app.use("/api/v1", v1Router);

app.post("/api/jobs", requireAuth, checkQuota, (req, res) => {
  const { action, params } = req.body || {};
  if (!action) return res.status(400).json({ error: "action_required" });
  if (!actionKnown(action)) return res.status(400).json({ error: "unknown_action" });
  try {
    const job = enqueueJob({
      orgId: req.org.id,
      userId: req.user.id,
      action,
      params: params || {},
      requestedBy: req.user.email
    });
    res.json({ job });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/jobs", requireAuth, (req, res) => {
  const { status, limit, offset } = req.query;
  const result = listJobs({
    orgId: req.org.id,
    status: status || undefined,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0
  });
  res.json(result);
});

app.get("/api/jobs/:id", requireAuth, (req, res) => {
  const job = getJob(req.params.id, req.org.id);
  if (!job) return res.status(404).json({ error: "not_found" });
  res.json({ job });
});

app.get("/api/jobs/:id/output", requireAuth, (req, res) => {
  const output = getJobOutput(req.params.id, req.org.id);
  if (output === null) return res.status(404).json({ error: "not_found" });
  res.type("text/plain").send(output);
});

app.get("/api/records", requireAuth, async (req, res) => {
  try {
    const { table, limit, offset, sortBy, sortDir, filter } = req.query;
    let parsedFilter;
    if (filter) {
      try {
        parsedFilter = JSON.parse(filter);
      } catch {
        return res.status(400).json({ error: "invalid_filter_json" });
      }
    }
    const creds = integrations.getOrgSmartSuiteCreds(req.org.id);
    if (!creds) {
      return res.status(412).json({ error: "smartsuite_not_configured" });
    }
    const data = await listRecords({
      creds,
      tableKey: String(table || ""),
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      sortBy: sortBy ? String(sortBy) : undefined,
      sortDir: sortDir ? String(sortDir) : undefined,
      filter: parsedFilter
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "failed_to_load_records" });
  }
});

app.get("/api/usage", requireAuth, (req, res) => {
  res.json(usage.getQuotaState(req.org.id));
});

const staticPath = path.join(ROOT_DIR, "dist", "public");
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

initQueue();
outreachScheduler.start();

app.listen(PORT, () => {
  console.log(`Prospect Forge server running on http://localhost:${PORT}`);
});
