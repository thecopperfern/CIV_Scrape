const express = require("express");
const { z } = require("zod");

const apiKeys = require("./apiKeys");
const { requireAuth, requireRole } = require("../middleware/requireAuth");
const plans = require("../billing/plans");

const router = express.Router();

const createSchema = z.object({
  name: z.string().min(1).max(100)
});

router.get("/", requireAuth, (req, res) => {
  res.json({
    items: apiKeys.listKeys(req.org.id),
    features: plans.featuresFor(req.org.plan)
  });
});

router.post("/", requireAuth, requireRole("owner", "admin"), (req, res) => {
  const features = plans.featuresFor(req.org.plan);
  if (!features.api) {
    return res.status(402).json({ error: "api_not_in_plan", upgradeUrl: "/app/settings/billing" });
  }
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const created = apiKeys.createKey({
    orgId: req.org.id,
    userId: req.user.id,
    name: parsed.data.name
  });
  res.json(created);
});

router.delete("/:id", requireAuth, requireRole("owner", "admin"), (req, res) => {
  apiKeys.revokeKey({ orgId: req.org.id, keyId: Number(req.params.id) });
  res.json({ ok: true });
});

module.exports = router;
