const rateLimit = require("express-rate-limit");
const plans = require("../billing/plans");

function rateLimitPerOrg() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => `org:${req.org?.id || "anon"}`,
    max: (req) => {
      const features = plans.featuresFor(req.org?.plan || "free");
      return features.rateLimit || 60;
    },
    message: { error: "rate_limited" }
  });
}

module.exports = { rateLimitPerOrg };
