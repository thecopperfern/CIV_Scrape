const express = require("express");
const { z } = require("zod");
const { prepare } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const usage = require("../billing/usage");

const router = express.Router();
router.use(requireAuth);

const OUTCOMES = ["connected", "voicemail", "no_answer", "wrong_number", "bad_number", "dnc"];

const createSchema = z.object({
  targetId: z.number().int().positive().optional().nullable(),
  externalId: z.string().max(200).optional().nullable(),
  outcome: z.enum(OUTCOMES),
  durationSeconds: z.number().int().min(0).max(36000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  followUpAt: z.string().datetime().optional().nullable()
});

const updateSchema = z.object({
  outcome: z.enum(OUTCOMES).optional(),
  durationSeconds: z.number().int().min(0).max(36000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  followUpAt: z.string().datetime().optional().nullable()
});

router.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const where = ["org_id = ?"];
  const params = [req.org.id];
  if (req.query.targetId) {
    where.push("target_id = ?");
    params.push(Number(req.query.targetId));
  }
  if (req.query.outcome && OUTCOMES.includes(String(req.query.outcome))) {
    where.push("outcome = ?");
    params.push(String(req.query.outcome));
  }
  const rows = prepare(
    `SELECT * FROM call_logs WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  const total = prepare(
    `SELECT COUNT(*) AS n FROM call_logs WHERE ${where.join(" AND ")}`
  ).get(...params).n;
  res.json({ items: rows, total });
});

router.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const r = prepare(
    `INSERT INTO call_logs(org_id, user_id, target_id, external_id, outcome, duration_seconds, notes, follow_up_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.org.id,
    req.user.id,
    parsed.data.targetId || null,
    parsed.data.externalId || null,
    parsed.data.outcome,
    parsed.data.durationSeconds || null,
    parsed.data.notes || null,
    parsed.data.followUpAt || null
  );
  usage.recordUsage({ orgId: req.org.id, userId: req.user.id, kind: "call_logged", qty: 1 });

  const row = prepare("SELECT * FROM call_logs WHERE id = ?").get(r.lastInsertRowid);
  res.json({ call: row });
});

router.patch("/:id", (req, res) => {
  const parsed = updateSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const existing = prepare("SELECT * FROM call_logs WHERE id = ? AND org_id = ?").get(
    Number(req.params.id), req.org.id
  );
  if (!existing) return res.status(404).json({ error: "not_found" });

  const sets = [];
  const values = [];
  if (parsed.data.outcome !== undefined) { sets.push("outcome = ?"); values.push(parsed.data.outcome); }
  if (parsed.data.durationSeconds !== undefined) { sets.push("duration_seconds = ?"); values.push(parsed.data.durationSeconds); }
  if (parsed.data.notes !== undefined) { sets.push("notes = ?"); values.push(parsed.data.notes); }
  if (parsed.data.followUpAt !== undefined) { sets.push("follow_up_at = ?"); values.push(parsed.data.followUpAt); }
  if (!sets.length) return res.json({ call: existing });

  values.push(Number(req.params.id), req.org.id);
  prepare(`UPDATE call_logs SET ${sets.join(", ")} WHERE id = ? AND org_id = ?`).run(...values);
  const updated = prepare("SELECT * FROM call_logs WHERE id = ?").get(Number(req.params.id));
  res.json({ call: updated });
});

module.exports = router;
