let cached = null;

function getStripe() {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  const Stripe = require("stripe");
  cached = new Stripe(key, { apiVersion: "2024-06-20" });
  return cached;
}

function isConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

module.exports = { getStripe, isConfigured };
