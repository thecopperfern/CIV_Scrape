const express = require("express");
const { z } = require("zod");
const axios = require("axios");

const smartsuiteStore = require("./smartsuite");
const resendStore = require("./resend");
const twilioStore = require("./twilio");
const emailSender = require("./email");
const smsSender = require("./sms");
const { requireAuth, requireRole } = require("../middleware/requireAuth");

const router = express.Router();

// ---------- SmartSuite ----------

const smartsuiteSchema = z.object({
  apiKey: z.string().min(8).max(500),
  accountId: z.string().min(4).max(200),
  sourceTableId: z.string().min(8).max(200).optional().nullable(),
  destTableId: z.string().min(8).max(200).optional().nullable()
});

router.get("/smartsuite", requireAuth, (req, res) => {
  res.json(smartsuiteStore.getOrgIntegrationStatus(req.org.id));
});

router.put("/smartsuite", requireAuth, requireRole("owner", "admin"), (req, res) => {
  const parsed = smartsuiteSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  res.json(smartsuiteStore.setOrgSmartSuiteCreds(req.org.id, parsed.data));
});

router.delete("/smartsuite", requireAuth, requireRole("owner", "admin"), (req, res) => {
  smartsuiteStore.deleteOrgSmartSuite(req.org.id);
  res.json({ ok: true });
});

router.post("/smartsuite/test", requireAuth, requireRole("owner", "admin"), async (req, res) => {
  const creds = smartsuiteStore.getOrgSmartSuiteCreds(req.org.id);
  if (!creds) return res.status(400).json({ ok: false, error: "not_configured" });
  try {
    const base = process.env.SMARTSUITE_BASE_URL || "https://app.smartsuite.com/api/v1";
    const tableId = creds.sourceTableId || creds.destTableId;
    if (!tableId) return res.status(400).json({ ok: false, error: "no_table_configured" });
    await axios.post(
      `${base}/applications/${tableId}/records/list/`,
      { filter: {}, sort: [] },
      {
        headers: {
          Authorization: `Token ${creds.apiKey}`,
          "Account-ID": creds.accountId,
          "Content-Type": "application/json"
        },
        params: { limit: 1, offset: 0 }
      }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.response?.status || err.message });
  }
});

// ---------- Resend ----------

const resendSchema = z.object({
  apiKey: z.string().min(8).max(500),
  fromEmail: z.string().email().max(200).optional().nullable(),
  fromName: z.string().max(200).optional().nullable()
});

router.get("/resend", requireAuth, (req, res) => {
  res.json(resendStore.getOrgIntegrationStatus(req.org.id));
});

router.put("/resend", requireAuth, requireRole("owner", "admin"), (req, res) => {
  const parsed = resendSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  res.json(resendStore.setOrgResendCreds(req.org.id, parsed.data));
});

router.delete("/resend", requireAuth, requireRole("owner", "admin"), (req, res) => {
  resendStore.deleteOrgResend(req.org.id);
  res.json({ ok: true });
});

router.post("/resend/test", requireAuth, requireRole("owner", "admin"), async (req, res) => {
  try {
    const result = await emailSender.testCredentials(req.org.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.code || err.message });
  }
});

// ---------- Twilio ----------

const twilioSchema = z.object({
  accountSid: z.string().min(8).max(200),
  authToken: z.string().min(8).max(500),
  fromNumber: z.string().min(4).max(20)
});

router.get("/twilio", requireAuth, (req, res) => {
  res.json(twilioStore.getOrgIntegrationStatus(req.org.id));
});

router.put("/twilio", requireAuth, requireRole("owner", "admin"), (req, res) => {
  const parsed = twilioSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  res.json(twilioStore.setOrgTwilioCreds(req.org.id, parsed.data));
});

router.delete("/twilio", requireAuth, requireRole("owner", "admin"), (req, res) => {
  twilioStore.deleteOrgTwilio(req.org.id);
  res.json({ ok: true });
});

router.post("/twilio/test", requireAuth, requireRole("owner", "admin"), async (req, res) => {
  try {
    const result = await smsSender.testCredentials(req.org.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.code || err.message });
  }
});

module.exports = router;
