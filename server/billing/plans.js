const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    prospects: 25,
    enrichments: 10,
    seats: 1,
    api: false,
    rateLimit: 30,
    description: "Kick the tires. 25 prospects/mo, 10 enrichments/mo.",
    stripePriceId: null
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 29,
    prospects: 250,
    enrichments: 100,
    seats: 1,
    api: false,
    rateLimit: 120,
    description: "For solo sellers prospecting weekly.",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 99,
    prospects: 2000,
    enrichments: 1000,
    seats: 5,
    api: true,
    rateLimit: 600,
    description: "Small sales teams. API access included.",
    stripePriceId: process.env.STRIPE_PRICE_PRO || null
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceMonthly: 299,
    prospects: 10000,
    enrichments: 5000,
    seats: -1,
    api: true,
    rateLimit: 6000,
    description: "Multi-client and high-volume. Unlimited seats.",
    stripePriceId: process.env.STRIPE_PRICE_AGENCY || null
  }
};

const CREDIT_PACKS = {
  small: { id: "small", credits: 100, price: 10, stripePriceId: process.env.STRIPE_PRICE_CREDITS_SMALL || null },
  medium: { id: "medium", credits: 600, price: 50, stripePriceId: process.env.STRIPE_PRICE_CREDITS_MEDIUM || null },
  large: { id: "large", credits: 3000, price: 200, stripePriceId: process.env.STRIPE_PRICE_CREDITS_LARGE || null }
};

function featuresFor(planId) {
  const plan = PLANS[planId] || PLANS.free;
  return {
    plan: plan.id,
    prospects: plan.prospects,
    enrichments: plan.enrichments,
    seats: plan.seats,
    api: plan.api,
    rateLimit: plan.rateLimit
  };
}

function planFromStripePriceId(priceId) {
  for (const id of Object.keys(PLANS)) {
    if (PLANS[id].stripePriceId === priceId) return id;
  }
  return null;
}

function creditPackFromStripePriceId(priceId) {
  for (const id of Object.keys(CREDIT_PACKS)) {
    if (CREDIT_PACKS[id].stripePriceId === priceId) return CREDIT_PACKS[id];
  }
  return null;
}

module.exports = {
  PLANS,
  CREDIT_PACKS,
  featuresFor,
  planFromStripePriceId,
  creditPackFromStripePriceId
};
