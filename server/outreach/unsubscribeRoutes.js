const express = require("express");
const crypto = require("crypto");
const { prepare, tx } = require("../db");

const router = express.Router();

function findOrgAndEmailByToken(token) {
  if (!token) return null;
  const candidates = prepare(
    `SELECT DISTINCT o.id AS org_id, oe.target_id, ct.email
     FROM outreach_events oe
     JOIN orgs o ON o.id = oe.org_id
     JOIN campaign_targets ct ON ct.id = oe.target_id
     WHERE oe.metadata_json LIKE ?`
  ).all(`%${token}%`);
  return candidates.find((c) => {
    if (!c.email) return false;
    const expected = crypto
      .createHash("sha256")
      .update(`${c.org_id}:${c.email}:${process.env.APP_ENCRYPTION_KEY || "dev"}`)
      .digest("base64url")
      .slice(0, 24);
    return expected === token;
  }) || null;
}

const recordUnsub = tx(({ orgId, email }) => {
  prepare(
    "INSERT INTO unsubscribes(org_id, email, reason) VALUES (?, ?, 'user_link')"
  ).run(orgId, email);
  prepare(
    "UPDATE campaign_targets SET status = 'unsubscribed', next_send_at = NULL, finished_at = datetime('now') WHERE org_id = ? AND email = ? AND status = 'active'"
  ).run(orgId, email);
});

function htmlResponse(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:80px auto;padding:0 24px;color:#222}</style>
  </head><body><h1>${title}</h1><p>${message}</p></body></html>`;
}

router.get("/:token", (req, res) => {
  const token = req.params.token;
  const match = findOrgAndEmailByToken(token);
  if (!match) {
    return res
      .status(404)
      .type("text/html")
      .send(htmlResponse("Link not found", "This unsubscribe link is invalid or already used."));
  }
  try {
    recordUnsub({ orgId: match.org_id, email: match.email });
  } catch (err) {
    if (!String(err.message).includes("UNIQUE")) {
      console.error("[unsubscribe]", err.message);
    }
  }
  res
    .type("text/html")
    .send(htmlResponse("You're unsubscribed", `We've removed ${match.email} from this sender's future emails.`));
});

module.exports = router;
