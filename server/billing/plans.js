const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    prospects: 25,
    enrichments: 10,
    emails: 0,
    platformEmail: false,
    platformSms: false,
    seats: 1,
    api: false,
    rateLimit: 30,
    description: "Kick the tires. BYO Resend + Twilio. 25 prospects/mo, 10 enrichments/mo.",
    stripePriceId: null
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 29,
    prospects: 250,
    enrichments: 100,
    emails: 500,
    platformEmail: true,
    platformSms: true,
    seats: 1,
    api: false,
    rateLimit: 120,
    description: "For solo sellers. 500 emails/mo included; SMS billed via credits.",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 99,
    prospects: 2000,
    enrichments: 1000,
    emails: 5000,
    platformEmail: true,
    platformSms: true,
    seats: 5,
    api: true,
    rateLimit: 600,
    description: "Small sales teams. 5,000 emails/mo + API access.",
    stripePriceId: process.env.STRIPE_PRICE_PRO || null
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceMonthly: 299,
    prospects: 10000,
    enrichments: 5000,
    emails: 50000,
    platformEmail: true,
    platformSms: true,
    seats: -1,
    api: true,
    rateLimit: 6000,
    description: "High-volume + unlimited seats. 50,000 emails/mo.",
    stripePriceId: process.env.STRIPE_PRICE_AGENCY || null
  }
};

const CREDIT_PACKS = {
  small: { id: "small", credits: 100, price: 10, stripePriceId: process.env.STRIPE_PRICE_CREDITS_SMALL || null },
  medium: { id: "medium", credits: 600, price: 50, stripePriceId: process.env.STRIPE_PRICE_CREDITS_MEDIUM || null },
  large: { id: "large", credits: 3000, price: 200, stripePriceId: process.env.STRIPE_PRICE_CREDITS_LARGE || null }
};

// 1 SMS = 5 credits (covers per-message provider cost + margin)
const SMS_CREDIT_COST = 5;

function featuresFor(planId) {
  const plan = PLANS[planId] || PLANS.free;
  return {
    plan: plan.id,
    prospects: plan.prospects,
    enrichments: plan.enrichments,
    emails: plan.emails,
    platformEmail: plan.platformEmail,
    platformSms: plan.platformSms,
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
  SMS_CREDIT_COST,
  featuresFor,
  planFromStripePriceId,
  creditPackFromStripePriceId
};
