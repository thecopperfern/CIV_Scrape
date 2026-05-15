const { prepare, tx } = require("../db");
const { getEmailSender, EmailNotConfigured } = require("../integrations/email");
const { getSmsSender, SmsNotConfigured } = require("../integrations/sms");
const { render } = require("./templating");
const usage = require("../billing/usage");
const credits = require("../billing/credits");
const plans = require("../billing/plans");
const templatesRepo = require("./templatesRepo");

const UNSUB_FOOTER_PATH = "/u/";

function tryParse(s) {
  try {
    return JSON.parse(s || "[]");
  } catch {
    return [];
  }
}

function pickTemplate(step) {
  const ids = tryParse(step.template_ids_json);
  if (!ids.length) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

function isUnsubscribed(orgId, { email, phone }) {
  if (!email && !phone) return false;
  const row = prepare(
    "SELECT 1 FROM unsubscribes WHERE org_id = ? AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?)) LIMIT 1"
  ).get(orgId, email, email, phone, phone);
  return Boolean(row);
}

function buildEmailHtml(html, unsubToken, baseUrl) {
  if (!unsubToken) return html;
  const link = `${baseUrl || ""}${UNSUB_FOOTER_PATH}${unsubToken}`;
  const footer = `<hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px"><p style="font-size:11px;color:#888;font-family:Arial,sans-serif">Don't want to hear from us? <a href="${link}" style="color:#888">Unsubscribe</a>.</p>`;
  return `${html || ""}${footer}`;
}

function buildEmailText(text, unsubToken, baseUrl) {
  if (!unsubToken) return text;
  const link = `${baseUrl || ""}${UNSUB_FOOTER_PATH}${unsubToken}`;
  return `${text || ""}\n\n---\nUnsubscribe: ${link}`;
}

function generateUnsubToken() {
  return require("crypto").randomBytes(16).toString("base64url");
}

const advanceTargetTx = tx(({ targetId, orgId, currentStep, nextSendAt, status, finishedAt }) => {
  const sets = ["current_step = ?", "next_send_at = ?"];
  const values = [currentStep, nextSendAt];
  if (status) {
    sets.push("status = ?");
    values.push(status);
  }
  if (finishedAt) {
    sets.push("finished_at = ?");
    values.push(finishedAt);
  }
  values.push(targetId, orgId);
  prepare(
    `UPDATE campaign_targets SET ${sets.join(", ")} WHERE id = ? AND org_id = ?`
  ).run(...values);
});

const recordSentEvent = tx(({ orgId, campaignId, targetId, stepId, templateId, channel, provider, providerMessageId, metadata }) => {
  prepare(
    `INSERT INTO outreach_events(org_id, campaign_id, target_id, step_id, template_id, channel, kind, provider, provider_message_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?)`
  ).run(orgId, campaignId, targetId, stepId, templateId, channel, provider, providerMessageId || null, JSON.stringify(metadata || {}));
});

function getCampaign(campaignId) {
  return prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
}

function getStep(campaignId, stepOrder) {
  return prepare(
    "SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_order = ?"
  ).get(campaignId, stepOrder);
}

function getDueTargets(orgId, batchSize) {
  return prepare(
    `SELECT * FROM campaign_targets
     WHERE org_id = ? AND status = 'active' AND next_send_at IS NOT NULL AND next_send_at <= datetime('now')
     ORDER BY next_send_at ASC LIMIT ?`
  ).all(orgId, batchSize);
}

function computeNextSendAt(step, fromDate = new Date()) {
  if (!step) return null;
  const next = new Date(fromDate);
  next.setUTCDate(next.getUTCDate() + (Number(step.day_offset) || 0));
  return next.toISOString();
}

async function sendEmailToTarget({ orgId, campaign, step, target, sender, log }) {
  const templateId = pickTemplate(step);
  if (!templateId) return { sent: false, reason: "no_template" };
  const template = templatesRepo.getTemplate(templateId, orgId);
  if (!template) return { sent: false, reason: "template_not_found" };
  if (!target.email) return { sent: false, reason: "no_email" };

  let unsubToken = null;
  const existing = prepare(
    "SELECT token FROM unsubscribes WHERE org_id = ? AND email = ? LIMIT 1"
  ).get(orgId, target.email);
  if (existing) return { sent: false, reason: "already_unsubscribed" };

  // Allocate an unsubscribe token preemptively (acts as the link target;
  // actual unsubscribe row is created on click).
  unsubToken = require("crypto")
    .createHash("sha256")
    .update(`${orgId}:${target.email}:${process.env.APP_ENCRYPTION_KEY || "dev"}`)
    .digest("base64url")
    .slice(0, 24);

  const rendered = render(template, target);
  const baseUrl = process.env.APP_BASE_URL || "";
  const html = buildEmailHtml(rendered.html, unsubToken, baseUrl);
  const text = buildEmailText(rendered.text, unsubToken, baseUrl);

  log(`[send] email target=${target.id} template=${template.id}`);
  const result = await sender.send({
    to: target.email,
    from: campaign.from_email || sender.defaultFromEmail,
    fromName: campaign.from_name || sender.defaultFromName,
    replyTo: campaign.reply_to_email || undefined,
    subject: rendered.subject,
    html,
    text,
    headers: {
      "X-PF-Org": String(orgId),
      "X-PF-Target": String(target.id),
      "X-PF-Campaign": String(campaign.id),
      "X-PF-Template": String(template.id),
      "List-Unsubscribe": `<${baseUrl}${UNSUB_FOOTER_PATH}${unsubToken}>`
    }
  });

  recordSentEvent({
    orgId,
    campaignId: campaign.id,
    targetId: target.id,
    stepId: step.id,
    templateId: template.id,
    channel: "email",
    provider: result.provider,
    providerMessageId: result.messageId,
    metadata: { to: target.email, unsubToken }
  });

  usage.recordUsage({
    orgId,
    jobId: null,
    kind: "email_sent",
    qty: 1
  });

  return { sent: true, provider: result.provider, messageId: result.messageId };
}

async function sendSmsToTarget({ orgId, campaign, step, target, sender, log }) {
  const templateId = pickTemplate(step);
  if (!templateId) return { sent: false, reason: "no_template" };
  const template = templatesRepo.getTemplate(templateId, orgId);
  if (!template) return { sent: false, reason: "template_not_found" };
  if (!target.phone) return { sent: false, reason: "no_phone" };

  const existing = prepare(
    "SELECT 1 FROM unsubscribes WHERE org_id = ? AND phone = ? LIMIT 1"
  ).get(orgId, target.phone);
  if (existing) return { sent: false, reason: "already_unsubscribed" };

  // SMS always debits credits regardless of plan (covers provider cost)
  try {
    credits.debitCredits({
      orgId,
      qty: plans.SMS_CREDIT_COST,
      reason: "sms",
      jobId: null
    });
  } catch (err) {
    return { sent: false, reason: "insufficient_credits" };
  }

  const rendered = render(template, target);
  log(`[send] sms target=${target.id} template=${template.id}`);
  const baseUrl = process.env.APP_BASE_URL || "";
  const statusUrl = baseUrl ? `${baseUrl}/api/webhooks/twilio/sms-status` : undefined;
  const result = await sender.send({
    to: target.phone,
    body: rendered.body,
    statusCallbackUrl: statusUrl
  });

  recordSentEvent({
    orgId,
    campaignId: campaign.id,
    targetId: target.id,
    stepId: step.id,
    templateId: template.id,
    channel: "sms",
    provider: result.provider,
    providerMessageId: result.messageId,
    metadata: { to: target.phone, credits: plans.SMS_CREDIT_COST }
  });

  usage.recordUsage({ orgId, kind: "sms_sent", qty: 1 });
  return { sent: true, provider: result.provider, messageId: result.messageId };
}

async function processOneTarget({ orgId, target, log }) {
  const campaign = getCampaign(target.campaign_id);
  if (!campaign || campaign.status !== "active") {
    advanceTargetTx({
      targetId: target.id,
      orgId,
      currentStep: target.current_step,
      nextSendAt: null,
      status: "active"
    });
    return { skipped: true, reason: "campaign_inactive" };
  }

  const step = getStep(target.campaign_id, target.current_step);
  if (!step) {
    advanceTargetTx({
      targetId: target.id,
      orgId,
      currentStep: target.current_step,
      nextSendAt: null,
      status: "done",
      finishedAt: new Date().toISOString()
    });
    return { skipped: true, reason: "no_more_steps", done: true };
  }

  if (isUnsubscribed(orgId, target)) {
    advanceTargetTx({
      targetId: target.id,
      orgId,
      currentStep: target.current_step,
      nextSendAt: null,
      status: "unsubscribed",
      finishedAt: new Date().toISOString()
    });
    return { skipped: true, reason: "unsubscribed" };
  }

  let sendResult = { sent: false, reason: "call_step_skipped" };
  try {
    if (step.channel === "email") {
      const sender = await getEmailSender(orgId);
      sendResult = await sendEmailToTarget({ orgId, campaign, step, target, sender, log });
    } else if (step.channel === "sms") {
      const sender = await getSmsSender(orgId);
      sendResult = await sendSmsToTarget({ orgId, campaign, step, target, sender, log });
    } else if (step.channel === "call") {
      // call steps are placeholders — manual logging happens separately
      sendResult = { sent: true, skipped: true, reason: "call_step_no_action" };
    }
  } catch (err) {
    if (err instanceof EmailNotConfigured || err instanceof SmsNotConfigured) {
      advanceTargetTx({
        targetId: target.id,
        orgId,
        currentStep: target.current_step,
        nextSendAt: null,
        status: "failed",
        finishedAt: new Date().toISOString()
      });
      return { skipped: true, reason: err.code };
    }
    log(`[send] ERROR target=${target.id}: ${err.message}`);
    prepare(
      `INSERT INTO outreach_events(org_id, campaign_id, target_id, step_id, channel, kind, metadata_json)
       VALUES (?, ?, ?, ?, ?, 'failed', ?)`
    ).run(orgId, campaign.id, target.id, step.id, step.channel, JSON.stringify({ error: err.message }));
    advanceTargetTx({
      targetId: target.id,
      orgId,
      currentStep: target.current_step,
      nextSendAt: null,
      status: "failed",
      finishedAt: new Date().toISOString()
    });
    return { skipped: true, reason: "send_failed", error: err.message };
  }

  // Advance to next step
  const nextStep = getStep(target.campaign_id, target.current_step + 1);
  if (!nextStep) {
    advanceTargetTx({
      targetId: target.id,
      orgId,
      currentStep: target.current_step + 1,
      nextSendAt: null,
      status: "done",
      finishedAt: new Date().toISOString()
    });
  } else {
    const nextAt = computeNextSendAt(nextStep);
    advanceTargetTx({
      targetId: target.id,
      orgId,
      currentStep: target.current_step + 1,
      nextSendAt: nextAt,
      status: "active"
    });
  }

  return sendResult;
}

async function processDueSends({ orgId, batchSize = 25, log = console.log } = {}) {
  const targets = getDueTargets(orgId, batchSize);
  log(`[send] org=${orgId} due=${targets.length}`);
  const results = [];
  for (const target of targets) {
    try {
      const r = await processOneTarget({ orgId, target, log });
      results.push({ targetId: target.id, ...r });
    } catch (err) {
      log(`[send] unhandled error target=${target.id}: ${err.message}`);
      results.push({ targetId: target.id, error: err.message });
    }
  }
  return {
    processed: results.length,
    sent: results.filter((r) => r.sent).length,
    skipped: results.filter((r) => r.skipped).length
  };
}

module.exports = { processDueSends, processOneTarget };
