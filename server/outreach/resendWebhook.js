const express = require("express");
const { prepare, tx } = require("../db");

const router = express.Router();

const KIND_MAP = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed"
};

function targetByMessageId(messageId) {
  if (!messageId) return null;
  return prepare(
    `SELECT target_id, org_id, campaign_id, template_id, step_id, channel
     FROM outreach_events
     WHERE provider_message_id = ? AND kind = 'sent'
     ORDER BY created_at DESC LIMIT 1`
  ).get(messageId);
}

const insertEventTx = tx(({ providerEventId, orgId, campaignId, targetId, stepId, templateId, channel, kind, providerMessageId, metadata }) => {
  const result = prepare(
    `INSERT OR IGNORE INTO outreach_events(
       org_id, campaign_id, target_id, step_id, template_id, channel, kind,
       provider, provider_message_id, provider_event_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'resend', ?, ?, ?)`
  ).run(
    orgId, campaignId, targetId, stepId, templateId, channel, kind,
    providerMessageId || null, providerEventId || null, JSON.stringify(metadata || {})
  );
  return result.changes > 0;
});

const recordBounceTx = tx(({ orgId, email, reason }) => {
  prepare(
    `INSERT INTO unsubscribes(org_id, email, reason) VALUES (?, ?, ?)`
  ).run(orgId, email, reason || "bounce");
  prepare(
    `UPDATE campaign_targets SET status = 'bounced', next_send_at = NULL, finished_at = datetime('now') WHERE org_id = ? AND email = ? AND status = 'active'`
  ).run(orgId, email);
});

const recordComplaintTx = tx(({ orgId, email }) => {
  prepare(
    `INSERT INTO unsubscribes(org_id, email, reason) VALUES (?, ?, 'complaint')`
  ).run(orgId, email);
  prepare(
    `UPDATE campaign_targets SET status = 'unsubscribed', next_send_at = NULL, finished_at = datetime('now') WHERE org_id = ? AND email = ? AND status = 'active'`
  ).run(orgId, email);
});

function verifySvix(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "secret_not_configured" };
  try {
    const { Webhook } = require("svix");
    const wh = new Webhook(secret);
    const headers = {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"]
    };
    const payload = req.body;
    const verified = wh.verify(payload, headers);
    return { ok: true, event: verified };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

router.post("/", express.raw({ type: "*/*" }), (req, res) => {
  const verification = verifySvix(req);
  if (!verification.ok) {
    if (verification.reason === "secret_not_configured") {
      return res.status(503).send("webhook_secret_not_configured");
    }
    return res.status(400).send(`signature_invalid: ${verification.reason}`);
  }

  const event = verification.event;
  const eventType = event.type || "";
  const kind = KIND_MAP[eventType];
  if (!kind) return res.json({ ok: true, ignored: eventType });

  const data = event.data || {};
  const providerEventId = event.id || event.event_id || null;
  if (!providerEventId) return res.status(400).send("missing_event_id");

  const messageId = data.email_id || data.id || null;
  const linked = targetByMessageId(messageId);
  const orgId = linked?.org_id || null;
  const recipientEmail = Array.isArray(data.to) ? data.to[0] : data.to;

  const inserted = insertEventTx({
    providerEventId,
    orgId,
    campaignId: linked?.campaign_id || null,
    targetId: linked?.target_id || null,
    stepId: linked?.step_id || null,
    templateId: linked?.template_id || null,
    channel: "email",
    kind,
    providerMessageId: messageId,
    metadata: { eventType, recipient: recipientEmail, data }
  });

  if (!inserted) {
    return res.json({ ok: true, duplicate: true });
  }

  try {
    if (kind === "bounced" && orgId && recipientEmail) {
      recordBounceTx({ orgId, email: recipientEmail, reason: data.bounce?.type || "bounce" });
    } else if (kind === "complained" && orgId && recipientEmail) {
      recordComplaintTx({ orgId, email: recipientEmail });
    }
  } catch (err) {
    console.error(`[resend-webhook] side-effect error: ${err.message}`);
  }

  res.json({ ok: true });
});

module.exports = router;
