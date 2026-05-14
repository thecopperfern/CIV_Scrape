const apiKeys = require("../auth/apiKeys");
const plans = require("../billing/plans");

function requireApiKey(req, res, next) {
  const header = req.headers["authorization"] || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "missing_bearer_token" });
  }
  const token = match[1].trim();
  const hash = apiKeys.hashKey(token);
  const row = apiKeys.findActiveByHash(hash);
  if (!row) {
    return res.status(401).json({ error: "invalid_token" });
  }

  const features = plans.featuresFor(row.org_plan);
  if (!features.api) {
    return res.status(402).json({
      error: "api_not_in_plan",
      plan: row.org_plan,
      upgradeUrl: "/app/settings/billing"
    });
  }

  apiKeys.touchKey(row.id);

  req.apiKey = { id: row.id, prefix: row.prefix, name: row.name };
  req.org = {
    id: row.org_id,
    name: row.org_name,
    slug: row.slug,
    plan: row.org_plan,
    credits_balance: row.credits_balance,
    stripe_customer_id: row.stripe_customer_id
  };
  req.user = null;
  req.role = "api";
  next();
}

module.exports = { requireApiKey };
