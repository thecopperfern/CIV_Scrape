const express = require("express");
const { prepare, tx } = require("../db");

const router = express.Router();

router.use(express.urlencoded({ extended: false }));

function targetByMessageId(messageId) {
  if (!messageId) return null;
  return prepare(
    `SELECT target_id, org_id, campaign_id, template_id, step_id
     FROM outreach_events
     WHERE provider_message_id = ? AND channel = 'sms' AND kind = 'sent'
     ORDER BY created_at DESC LIMIT 1`
  ).get(messageId);
}

function targetByPhone(orgId, phone) {
  return prepare(
    `SELECT id AS target_id, campaign_id FROM campaign_targets
     WHERE org_id = ? AND phone = ? AND status IN ('active','done')
     ORDER BY enrolled_at DESC LIMIT 1`
  ).get(orgId, phone);
}

const insertEvent = tx(({ providerEventId, orgId, campaignId, targetId, stepId, templateId, kind, providerMessageId, metadata }) => {
  const result = prepare(
    `INSERT OR IGNORE INTO outreach_events(
       org_id, campaign_id, target_id, step_id, template_id, channel, kind,
       provider, provider_message_id, provider_event_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, 'sms', ?, 'twilio', ?, ?, ?)`
  ).run(
    orgId, campaignId, targetId, stepId, templateId, kind,
    providerMessageId || null, providerEventId || null, JSON.stringify(metadata || {})
  );
  return result.changes > 0;
});

const markReplied = tx(({ orgId, targetId }) => {
  prepare(
    "UPDATE campaign_targets SET status = 'replied', next_send_at = NULL, finished_at = datetime('now') WHERE id = ? AND org_id = ? AND status = 'active'"
  ).run(targetId, orgId);
});

const recordSmsUnsub = tx(({ orgId, phone }) => {
  prepare(
    "INSERT INTO unsubscribes(org_id, phone, reason) VALUES (?, ?, 'sms_stop')"
  ).run(orgId, phone);
  prepare(
    "UPDATE campaign_targets SET status = 'unsubscribed', next_send_at = NULL, finished_at = datetime('now') WHERE org_id = ? AND phone = ? AND status = 'active'"
  ).run(orgId, phone);
});

function isStopKeyword(body) {
  if (!body) return false;
  const t = String(body).trim().toUpperCase();
  return t === "STOP" || t === "UNSUBSCRIBE" || t === "STOPALL" || t === "CANCEL" || t === "END" || t === "QUIT";
}

router.post("/sms-status", (req, res) => {
  const messageSid = req.body?.MessageSid || req.body?.SmsSid;
  const status = req.body?.MessageStatus || req.body?.SmsStatus;
  if (!messageSid || !status) return res.status(400).send("missing_params");

  const linked = targetByMessageId(messageSid);
  const orgId = linked?.org_id || null;
  const providerEventId = `${messageSid}:${status}`;

  let kind = null;
  if (status === "delivered") kind = "delivered";
  else if (status === "failed" || status === "undelivered") kind = "failed";
  else if (status === "sent" || status === "queued") kind = null; // ignore

  if (kind) {
    insertEvent({
      providerEventId,
      orgId,
      campaignId: linked?.campaign_id || null,
      targetId: linked?.target_id || null,
      stepId: linked?.step_id || null,
      templateId: linked?.template_id || null,
      kind,
      providerMessageId: messageSid,
      metadata: { status, raw: req.body }
    });
  }

  res.type("text/xml").send("<Response></Response>");
});

router.post("/sms-inbound", (req, res) => {
  const from = req.body?.From;
  const to = req.body?.To;
  const body = req.body?.Body || "";
  const messageSid = req.body?.MessageSid;

  if (!from || !to) return res.status(400).send("missing_params");

  // Find any active target with this phone number across all orgs (Twilio's
  // platform-managed number is shared; BYO numbers map to a single org).
  const target = prepare(
    `SELECT t.id AS target_id, t.org_id, t.campaign_id FROM campaign_targets t
     WHERE t.phone = ? ORDER BY t.enrolled_at DESC LIMIT 1`
  ).get(from);

  if (!target) {
    // No matching target — record nothing, send empty TwiML
    return res.type("text/xml").send("<Response></Response>");
  }

  const providerEventId = `inbound:${messageSid}`;
  const stopRequested = isStopKeyword(body);

  insertEvent({
    providerEventId,
    orgId: target.org_id,
    campaignId: target.campaign_id,
    targetId: target.target_id,
    kind: stopRequested ? "unsubscribed" : "replied",
    providerMessageId: messageSid,
    metadata: { from, to, body }
  });

  if (stopRequested) {
    recordSmsUnsub({ orgId: target.org_id, phone: from });
  } else {
    markReplied({ orgId: target.org_id, targetId: target.target_id });
  }

  res.type("text/xml").send("<Response></Response>");
});

module.exports = router;
