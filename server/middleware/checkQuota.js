const usage = require("../billing/usage");
const credits = require("../billing/credits");
const plans = require("../billing/plans");

function estimateCost(action, params) {
  const limit = Math.max(1, Number(params?.limit) || 1);
  if (action === "find-prospects") return { prospects: limit, enrichments: 0 };
  if (action === "research-prospects") return { prospects: 0, enrichments: limit };
  return { prospects: 0, enrichments: 0 };
}

function checkQuota(req, res, next) {
  const action = req.body?.action;
  if (!action) return next();

  const features = plans.featuresFor(req.org.plan);
  const state = usage.getMonthlyUsage(req.org.id);
  const cost = estimateCost(action, req.body?.params || {});

  if (cost.prospects > 0) {
    const remaining = features.prospects - state.prospectsUsed;
    if (cost.prospects > remaining) {
      return res.status(402).json({
        error: "quota_exceeded",
        kind: "prospects",
        plan: req.org.plan,
        used: state.prospectsUsed,
        limit: features.prospects,
        requested: cost.prospects,
        upgradeUrl: "/app/settings/billing"
      });
    }
  }

  if (cost.enrichments > 0) {
    const remaining = Math.max(0, features.enrichments - state.enrichmentsUsed);
    const overage = Math.max(0, cost.enrichments - remaining);
    const balance = credits.getBalance(req.org.id);
    if (overage > balance) {
      return res.status(402).json({
        error: "quota_exceeded",
        kind: "enrichments",
        plan: req.org.plan,
        used: state.enrichmentsUsed,
        limit: features.enrichments,
        requested: cost.enrichments,
        creditsAvailable: balance,
        creditsNeeded: overage - balance,
        upgradeUrl: "/app/settings/billing",
        creditPackUrl: "/app/settings/billing"
      });
    }
  }

  next();
}

module.exports = { checkQuota, estimateCost };
