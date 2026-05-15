const twilioStore = require("./twilio");
const plans = require("../billing/plans");
const { prepare } = require("../db");

class SmsNotConfigured extends Error {
  constructor(message) {
    super(message || "sms_not_configured");
    this.code = "SMS_NOT_CONFIGURED";
  }
}

function getOrgPlan(orgId) {
  const row = prepare("SELECT plan FROM orgs WHERE id = ?").get(orgId);
  return row?.plan || "free";
}

function resolveCreds(orgId) {
  const byo = twilioStore.getOrgTwilioCreds(orgId);
  if (byo) return byo;

  const plan = getOrgPlan(orgId);
  const platformAllowed = plans.featuresFor(plan)?.platformSms === true;
  if (platformAllowed) {
    const platform = twilioStore.envFallbackCreds();
    if (platform) return platform;
  }
  return null;
}

let cachedClient = null;
let cachedSid = null;
function getTwilioClient(sid, token) {
  if (cachedClient && cachedSid === sid) return cachedClient;
  const twilio = require("twilio");
  cachedClient = twilio(sid, token);
  cachedSid = sid;
  return cachedClient;
}

async function getSmsSender(orgId) {
  const creds = resolveCreds(orgId);
  if (!creds) throw new SmsNotConfigured();
  const client = getTwilioClient(creds.accountSid, creds.authToken);
  return {
    provider: "twilio",
    platformManaged: Boolean(creds.platformManaged),
    defaultFromNumber: creds.fromNumber,
    async send({ to, body, statusCallbackUrl }) {
      const message = await client.messages.create({
        from: creds.fromNumber,
        to,
        body,
        statusCallback: statusCallbackUrl || undefined
      });
      return {
        provider: "twilio",
        messageId: message.sid,
        raw: { status: message.status, to: message.to }
      };
    }
  };
}

async function testCredentials(orgId) {
  const creds = resolveCreds(orgId);
  if (!creds) throw new SmsNotConfigured();
  const twilio = require("twilio");
  const client = twilio(creds.accountSid, creds.authToken);
  const account = await client.api.accounts(creds.accountSid).fetch();
  return { ok: true, accountStatus: account.status };
}

function validateInboundSignature({ orgId, signature, url, params }) {
  const creds = resolveCreds(orgId);
  if (!creds) return false;
  const twilio = require("twilio");
  return twilio.validateRequest(creds.authToken, signature, url, params);
}

module.exports = {
  getSmsSender,
  testCredentials,
  validateInboundSignature,
  SmsNotConfigured
};
