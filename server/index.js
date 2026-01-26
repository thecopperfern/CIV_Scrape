const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");

const { enqueueJob, initQueue, listJobs, getJob, getJobOutput } = require("./jobs/queue");
const { listRecords } = require("./smartsuite");

const ROOT_DIR = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT_DIR, ".env") });

const app = express();
const PORT = process.env.PORT || 3001;
const IS_DEV = process.env.NODE_ENV !== "production";

app.set("trust proxy", 1);

if (IS_DEV) {
  app.use(cors({ origin: "http://localhost:3000", credentials: true }));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: !IS_DEV,
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAuth(req, res, next) {
  if (req.session?.authed) return next();
  return res.status(401).json({ success: false, message: "Unauthorized" });
}

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ success: false, message: "ADMIN_PASSWORD not configured" });
  }

  if (!safeCompare(String(password || ""), adminPassword)) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  req.session.authed = true;
  res.json({ success: true, user: "admin" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get("/api/me", (req, res) => {
  if (req.session?.authed) {
    return res.json({ authenticated: true, user: "admin" });
  }
  return res.json({ authenticated: false });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/jobs", requireAuth, (req, res) => {
  const { action, params } = req.body || {};
  if (!action) {
    return res.status(400).json({ success: false, message: "Action is required" });
  }

  const job = enqueueJob({ action, params, requestedBy: "admin" });
  res.json({ success: true, job });
});

app.get("/api/jobs", requireAuth, (req, res) => {
  const { status, limit, offset } = req.query;
  const result = listJobs({
    status: status || undefined,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0
  });
  res.json({ success: true, ...result });
});

app.get("/api/jobs/:id", requireAuth, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }
  res.json({ success: true, job });
});

app.get("/api/jobs/:id/output", requireAuth, (req, res) => {
  const output = getJobOutput(req.params.id);
  if (!output) {
    return res.status(404).json({ success: false, message: "Output not found" });
  }
  res.type("text/plain").send(output);
});

app.get("/api/records", requireAuth, async (req, res) => {
  try {
    const { table, limit, offset, sortBy, sortDir, filter } = req.query;
    let parsedFilter = undefined;
    if (filter) {
      try {
        parsedFilter = JSON.parse(filter);
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid filter JSON" });
      }
    }

    const data = await listRecords({
      tableKey: String(table || ""),
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      sortBy: sortBy ? String(sortBy) : undefined,
      sortDir: sortDir ? String(sortDir) : undefined,
      filter: parsedFilter
    });

    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to load records" });
  }
});

const staticPath = path.join(ROOT_DIR, "dist", "public");
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

initQueue();

app.listen(PORT, () => {
  console.log(`CIV Scrape server running on http://localhost:${PORT}`);
});
