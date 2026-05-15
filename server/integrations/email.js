const resendStore = require("./resend");
const plans = require("../billing/plans");
const { prepare } = require("../db");

class EmailNotConfigured extends Error {
  constructor(message) {
    super(message || "email_not_configured");
    this.code = "EMAIL_NOT_CONFIGURED";
  }
}

function getOrgPlan(orgId) {
  const row = prepare("SELECT plan FROM orgs WHERE id = ?").get(orgId);
  return row?.plan || "free";
}

function resolveCreds(orgId) {
  const byo = resendStore.getOrgResendCreds(orgId);
  if (byo) return byo;

  const plan = getOrgPlan(orgId);
  const platformAllowed = plans.featuresFor(plan)?.platformEmail === true;
  if (platformAllowed) {
    const platform = resendStore.envFallbackCreds();
    if (platform) return platform;
  }
  return null;
}

let cachedClient = null;
let cachedKey = null;
function getResendClient(apiKey) {
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  const { Resend } = require("resend");
  cachedClient = new Resend(apiKey);
  cachedKey = apiKey;
  return cachedClient;
}

async function getEmailSender(orgId) {
  const creds = resolveCreds(orgId);
  if (!creds) throw new EmailNotConfigured();
  const client = getResendClient(creds.apiKey);
  return {
    provider: "resend",
    platformManaged: Boolean(creds.platformManaged),
    defaultFromEmail: creds.fromEmail || null,
    defaultFromName: creds.fromName || null,
    async send({ to, from, fromName, replyTo, subject, html, text, headers, tags }) {
      const fromAddress = from || creds.fromEmail;
      if (!fromAddress) throw new Error("from_email_required");
      const sender = fromName || creds.fromName
        ? `${fromName || creds.fromName} <${fromAddress}>`
        : fromAddress;
      const response = await client.emails.send({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        replyTo: replyTo || undefined,
        headers: headers || undefined,
        tags: tags || undefined
      });
      if (response.error) {
        const err = new Error(response.error.message || "resend_send_failed");
        err.code = response.error.name || "RESEND_ERROR";
        throw err;
      }
      return {
        provider: "resend",
        messageId: response.data?.id || null,
        raw: response.data
      };
    }
  };
}

async function testCredentials(orgId) {
  const creds = resolveCreds(orgId);
  if (!creds) throw new EmailNotConfigured();
  const { Resend } = require("resend");
  const client = new Resend(creds.apiKey);
  const result = await client.domains.list();
  if (result.error) throw new Error(result.error.message || "resend_test_failed");
  return { ok: true, domainCount: result.data?.data?.length ?? 0 };
}

module.exports = { getEmailSender, testCredentials, EmailNotConfigured };
