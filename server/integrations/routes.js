const express = require("express");
const { z } = require("zod");
const axios = require("axios");

const integrations = require("./smartsuite");
const { requireAuth, requireRole } = require("../middleware/requireAuth");

const router = express.Router();

const updateSchema = z.object({
  apiKey: z.string().min(8).max(500),
  accountId: z.string().min(4).max(200),
  sourceTableId: z.string().min(8).max(200).optional().nullable(),
  destTableId: z.string().min(8).max(200).optional().nullable()
});

router.get("/smartsuite", requireAuth, (req, res) => {
  const status = integrations.getOrgIntegrationStatus(req.org.id);
  res.json(status);
});

router.put("/smartsuite", requireAuth, requireRole("owner", "admin"), (req, res) => {
  const parsed = updateSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const status = integrations.setOrgSmartSuiteCreds(req.org.id, parsed.data);
  res.json(status);
});

router.delete("/smartsuite", requireAuth, requireRole("owner", "admin"), (req, res) => {
  integrations.deleteOrgSmartSuite(req.org.id);
  res.json({ ok: true });
});

router.post("/smartsuite/test", requireAuth, requireRole("owner", "admin"), async (req, res) => {
  const creds = integrations.getOrgSmartSuiteCreds(req.org.id);
  if (!creds) return res.status(400).json({ ok: false, error: "not_configured" });
  try {
    const base = process.env.SMARTSUITE_BASE_URL || "https://app.smartsuite.com/api/v1";
    const tableId = creds.sourceTableId || creds.destTableId;
    if (!tableId) {
      return res.status(400).json({ ok: false, error: "no_table_configured" });
    }
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

module.exports = router;
