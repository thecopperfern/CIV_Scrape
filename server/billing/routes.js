const express = require("express");
const { z } = require("zod");

const { getStripe, isConfigured } = require("./stripe");
const plans = require("./plans");
const subscriptions = require("./subscriptions");
const credits = require("./credits");
const { requireAuth, requireRole } = require("../middleware/requireAuth");

const router = express.Router();

const checkoutSubSchema = z.object({
  plan: z.enum(["starter", "pro", "agency"])
});

const checkoutCreditsSchema = z.object({
  pack: z.enum(["small", "medium", "large"])
});

async function getOrCreateCustomer(stripe, org) {
  if (org.stripe_customer_id) return org.stripe_customer_id;
  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { org_id: String(org.id), slug: org.slug }
  });
  subscriptions.setStripeCustomerId(org.id, customer.id);
  return customer.id;
}

router.post("/checkout/subscription", requireAuth, requireRole("owner", "admin"), async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: "billing_not_configured" });
  const parsed = checkoutSubSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const plan = plans.PLANS[parsed.data.plan];
  if (!plan.stripePriceId) {
    return res.status(500).json({ error: "price_not_configured", plan: parsed.data.plan });
  }

  const stripe = getStripe();
  const customerId = await getOrCreateCustomer(stripe, req.org);
  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

  const sessionObj = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${base}/app/settings/billing?status=success`,
    cancel_url: `${base}/app/settings/billing?status=canceled`,
    metadata: { org_id: String(req.org.id), plan: plan.id },
    subscription_data: {
      metadata: { org_id: String(req.org.id), plan: plan.id }
    }
  });

  res.json({ url: sessionObj.url });
});

router.post("/checkout/credits", requireAuth, requireRole("owner", "admin"), async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: "billing_not_configured" });
  const parsed = checkoutCreditsSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const pack = plans.CREDIT_PACKS[parsed.data.pack];
  if (!pack.stripePriceId) {
    return res.status(500).json({ error: "price_not_configured", pack: parsed.data.pack });
  }

  const stripe = getStripe();
  const customerId = await getOrCreateCustomer(stripe, req.org);
  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

  const sessionObj = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: pack.stripePriceId, quantity: 1 }],
    success_url: `${base}/app/settings/billing?status=credits_added`,
    cancel_url: `${base}/app/settings/billing?status=canceled`,
    metadata: {
      org_id: String(req.org.id),
      pack: pack.id,
      credits: String(pack.credits),
      kind: "credit_pack"
    }
  });

  res.json({ url: sessionObj.url });
});

router.post("/portal", requireAuth, requireRole("owner", "admin"), async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: "billing_not_configured" });
  if (!req.org.stripe_customer_id) {
    return res.status(400).json({ error: "no_customer" });
  }
  const stripe = getStripe();
  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const portal = await stripe.billingPortal.sessions.create({
    customer: req.org.stripe_customer_id,
    return_url: `${base}/app/settings/billing`
  });
  res.json({ url: portal.url });
});

router.get("/subscription", requireAuth, (req, res) => {
  const sub = subscriptions.getSubscription(req.org.id);
  res.json({
    plan: req.org.plan,
    features: plans.featuresFor(req.org.plan),
    credits: credits.getBalance(req.org.id),
    subscription: sub
      ? {
          status: sub.status,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          currentPeriodEnd: sub.current_period_end
        }
      : null,
    pricing: plans.PLANS,
    creditPacks: plans.CREDIT_PACKS
  });
});

router.get("/ledger", requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  res.json({ items: credits.ledger(req.org.id, { limit, offset }) });
});

module.exports = router;
