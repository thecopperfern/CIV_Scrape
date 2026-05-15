const express = require("express");
const { z } = require("zod");
const repo = require("./campaignsRepo");
const templatesRepo = require("./templatesRepo");
const { render } = require("./templating");
const { requireAuth, requireRole } = require("../middleware/requireAuth");
const { getEmailSender } = require("../integrations/email");
const { getSmsSender } = require("../integrations/sms");
const { prepare } = require("../db");
const usage = require("../billing/usage");
const plans = require("../billing/plans");

const router = express.Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  fromName: z.string().max(200).optional(),
  fromEmail: z.string().email().max(200).optional(),
  replyToEmail: z.string().email().max(200).optional()
});

const updateSchema = createSchema.partial();

const stepSchema = z.object({
  channel: z.enum(["email", "sms", "call"]),
  dayOffset: z.number().int().min(0).max(180).default(0),
  templateIds: z.array(z.number().int().positive()).default([]),
  sendWindowStart: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  sendWindowEnd: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  sendWindowTz: z.string().max(100).optional(),
  sendOnWeekdaysOnly: z.boolean().optional()
});

const stepsSchema = z.object({
  steps: z.array(stepSchema).min(1).max(20)
});

const targetSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  name: z.string().max(200).optional().nullable(),
  displayName: z.string().max(200).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  externalId: z.string().max(200).optional().nullable(),
  customFields: z.record(z.any()).optional()
});

const importSchema = z.object({
  targets: z.array(targetSchema).min(1).max(5000)
});

const sendTestSchema = z.object({
  to: z.string().min(3).max(200),
  templateId: z.number().int().positive(),
  sample: z.record(z.any()).optional()
});

router.get("/", (req, res) => {
  const result = repo.listCampaigns({
    orgId: req.org.id,
    status: req.query.status ? String(req.query.status) : undefined,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0
  });
  res.json(result);
});

router.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const c = repo.createCampaign({ orgId: req.org.id, userId: req.user.id, ...parsed.data });
  res.json({ campaign: c });
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const steps = repo.listSteps(id);
  res.json({ campaign: c, steps });
});

router.put("/:id", (req, res) => {
  const parsed = updateSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const c = repo.getCampaign(Number(req.params.id), req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  if (c.status !== "draft" && c.status !== "paused") {
    return res.status(400).json({ error: "campaign_not_editable" });
  }
  const updated = repo.updateCampaign(Number(req.params.id), req.org.id, parsed.data);
  res.json({ campaign: updated });
});

router.post("/:id/steps", (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  if (c.status !== "draft" && c.status !== "paused") {
    return res.status(400).json({ error: "campaign_not_editable" });
  }
  const parsed = stepsSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  for (const s of parsed.data.steps) {
    if (s.channel !== "call" && (!s.templateIds || s.templateIds.length === 0)) {
      return res.status(400).json({ error: "template_required", channel: s.channel });
    }
    for (const tid of s.templateIds || []) {
      const t = templatesRepo.getTemplate(tid, req.org.id);
      if (!t) return res.status(400).json({ error: "template_not_found", templateId: tid });
      if (t.channel !== s.channel) {
        return res.status(400).json({ error: "template_channel_mismatch", templateId: tid });
      }
    }
  }

  repo.replaceSteps({ campaignId: id, steps: parsed.data.steps });
  res.json({ steps: repo.listSteps(id) });
});

router.get("/:id/targets", (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const result = repo.listTargets({
    orgId: req.org.id,
    campaignId: id,
    status: req.query.status ? String(req.query.status) : undefined,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0
  });
  res.json(result);
});

router.post("/:id/targets/import", (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const parsed = importSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const count = repo.importTargets({ orgId: req.org.id, campaignId: id, targets: parsed.data.targets });
  res.json({ imported: count });
});

router.post("/:id/start", requireRole("owner", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const steps = repo.listSteps(id);
  if (steps.length === 0) return res.status(400).json({ error: "no_steps" });

  const targetsCount = c.stats.targets;
  if (targetsCount === 0) return res.status(400).json({ error: "no_targets" });

  const hasEmailStep = steps.some((s) => s.channel === "email");
  const hasSmsStep = steps.some((s) => s.channel === "sms");

  if (hasEmailStep) {
    try {
      await getEmailSender(req.org.id);
    } catch (err) {
      return res.status(412).json({ error: "email_not_configured", message: "Connect Resend in Settings → Integrations" });
    }
    const features = plans.featuresFor(req.org.plan);
    const used = usage.getMonthlyUsage(req.org.id);
    const remaining = Math.max(0, features.emails - used.emailsUsed);
    const emailSteps = steps.filter((s) => s.channel === "email").length;
    const estimated = targetsCount * emailSteps;
    if (features.emails > 0 && estimated > remaining) {
      return res.status(402).json({
        error: "quota_exceeded",
        kind: "emails",
        plan: req.org.plan,
        used: used.emailsUsed,
        limit: features.emails,
        requested: estimated,
        upgradeUrl: "/app/settings/billing"
      });
    }
  }

  if (hasSmsStep) {
    try {
      await getSmsSender(req.org.id);
    } catch (err) {
      return res.status(412).json({ error: "sms_not_configured", message: "Connect Twilio in Settings → Integrations" });
    }
  }

  repo.startCampaign({ campaignId: id, orgId: req.org.id, firstSendAt: new Date().toISOString() });
  res.json({ campaign: repo.getCampaign(id, req.org.id) });
});

router.post("/:id/pause", requireRole("owner", "admin"), (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  repo.pauseCampaign(id, req.org.id);
  res.json({ campaign: repo.getCampaign(id, req.org.id) });
});

router.post("/:id/resume", requireRole("owner", "admin"), (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  repo.resumeCampaign({ campaignId: id, orgId: req.org.id, nextSendAt: new Date().toISOString() });
  res.json({ campaign: repo.getCampaign(id, req.org.id) });
});

router.post("/:id/send-test", requireRole("owner", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const parsed = sendTestSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const t = templatesRepo.getTemplate(parsed.data.templateId, req.org.id);
  if (!t) return res.status(404).json({ error: "template_not_found" });

  try {
    if (t.channel === "email") {
      const sender = await getEmailSender(req.org.id);
      const sampleTarget = {
        display_name: "Test Recipient",
        email: parsed.data.to,
        company: "Test Co",
        custom_fields_json: JSON.stringify(parsed.data.sample || {})
      };
      const rendered = render(t, sampleTarget);
      const result = await sender.send({
        to: parsed.data.to,
        from: c.fromEmail || sender.defaultFromEmail,
        fromName: c.fromName || sender.defaultFromName,
        replyTo: c.replyToEmail || undefined,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
      });
      prepare(
        `INSERT INTO outreach_events(org_id, campaign_id, template_id, channel, kind, provider, provider_message_id, metadata_json)
         VALUES (?, ?, ?, 'email', 'sent', ?, ?, ?)`
      ).run(req.org.id, id, t.id, result.provider, result.messageId || null, JSON.stringify({ test: true, to: parsed.data.to }));
      res.json({ ok: true, messageId: result.messageId });
    } else if (t.channel === "sms") {
      const sender = await getSmsSender(req.org.id);
      const rendered = render(t, {
        display_name: "Test Recipient",
        phone: parsed.data.to,
        custom_fields_json: JSON.stringify(parsed.data.sample || {})
      });
      const result = await sender.send({ to: parsed.data.to, body: rendered.body });
      prepare(
        `INSERT INTO outreach_events(org_id, campaign_id, template_id, channel, kind, provider, provider_message_id, metadata_json)
         VALUES (?, ?, ?, 'sms', 'sent', ?, ?, ?)`
      ).run(req.org.id, id, t.id, result.provider, result.messageId || null, JSON.stringify({ test: true, to: parsed.data.to }));
      res.json({ ok: true, messageId: result.messageId });
    } else {
      res.status(400).json({ error: "call_template_not_sendable" });
    }
  } catch (err) {
    res.status(400).json({ error: err.code || "send_failed", message: err.message });
  }
});

router.get("/:id/events", (req, res) => {
  const id = Number(req.params.id);
  const c = repo.getCampaign(id, req.org.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const items = prepare(
    `SELECT id, target_id, step_id, template_id, channel, kind, provider, provider_message_id, created_at, metadata_json
     FROM outreach_events WHERE org_id = ? AND campaign_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(req.org.id, id, limit);
  res.json({ items });
});

module.exports = router;
