const express = require("express");
const { z } = require("zod");
const repo = require("./templatesRepo");
const { render } = require("./templating");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  channel: z.enum(["email", "sms"]),
  subject: z.string().max(500).optional(),
  body: z.string().min(1).max(50000),
  variantLabel: z.string().max(50).optional()
});

const updateSchema = createSchema.partial();

const previewSchema = z.object({
  target: z.record(z.any()).optional()
});

router.get("/", (req, res) => {
  const items = repo.listTemplates({
    orgId: req.org.id,
    channel: req.query.channel ? String(req.query.channel) : undefined,
    includeArchived: req.query.includeArchived === "true"
  });
  res.json({ items });
});

router.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  if (parsed.data.channel === "email" && !parsed.data.subject) {
    return res.status(400).json({ error: "subject_required_for_email" });
  }
  const t = repo.createTemplate({ orgId: req.org.id, userId: req.user.id, ...parsed.data });
  res.json({ template: t });
});

router.get("/:id", (req, res) => {
  const t = repo.getTemplate(Number(req.params.id), req.org.id);
  if (!t) return res.status(404).json({ error: "not_found" });
  res.json({ template: t });
});

router.put("/:id", (req, res) => {
  const parsed = updateSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const existing = repo.getTemplate(Number(req.params.id), req.org.id);
  if (!existing) return res.status(404).json({ error: "not_found" });
  const t = repo.updateTemplate(Number(req.params.id), req.org.id, parsed.data);
  res.json({ template: t });
});

router.delete("/:id", (req, res) => {
  repo.deleteTemplate(Number(req.params.id), req.org.id);
  res.json({ ok: true });
});

router.post("/:id/preview", (req, res) => {
  const t = repo.getTemplate(Number(req.params.id), req.org.id);
  if (!t) return res.status(404).json({ error: "not_found" });
  const parsed = previewSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const sample = parsed.data.target || {
    display_name: "Alex Sample",
    email: "alex@sample.co",
    company: "Sample Co",
    phone: "+1 555 010 1234",
    custom_fields_json: "{}"
  };
  res.json({ rendered: render(t, sample) });
});

module.exports = router;
