const express = require("express");
const { z } = require("zod");

const { enqueueJob, listJobs, getJob, getJobOutput, ACTIONS } = require("../../jobs/queue");
const usage = require("../../billing/usage");
const { requireApiKey } = require("../../middleware/requireApiKey");
const { rateLimitPerOrg } = require("../../middleware/rateLimit");
const { checkQuota } = require("../../middleware/checkQuota");

const router = express.Router();

router.use(requireApiKey);
router.use(rateLimitPerOrg());

const createJobSchema = z.object({
  action: z.string().min(1),
  params: z.record(z.any()).optional().default({})
});

router.post("/jobs", checkQuota, (req, res) => {
  const parsed = createJobSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (!ACTIONS[parsed.data.action]) {
    return res.status(400).json({ error: "unknown_action" });
  }
  try {
    const job = enqueueJob({
      orgId: req.org.id,
      action: parsed.data.action,
      params: parsed.data.params,
      requestedBy: `apikey:${req.apiKey.prefix}`
    });
    res.json({ job });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/jobs", (req, res) => {
  const result = listJobs({
    orgId: req.org.id,
    status: req.query.status,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0
  });
  res.json(result);
});

router.get("/jobs/:id", (req, res) => {
  const job = getJob(req.params.id, req.org.id);
  if (!job) return res.status(404).json({ error: "not_found" });
  res.json({ job });
});

router.get("/jobs/:id/output", (req, res) => {
  const output = getJobOutput(req.params.id, req.org.id);
  if (output === null) return res.status(404).json({ error: "not_found" });
  res.type("text/plain").send(output);
});

router.get("/usage", (req, res) => {
  res.json(usage.getQuotaState(req.org.id));
});

module.exports = router;
