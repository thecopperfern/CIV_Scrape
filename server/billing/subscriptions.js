const { prepare } = require("../db");

function getSubscription(orgId) {
  return prepare("SELECT * FROM subscriptions WHERE org_id = ?").get(orgId);
}

function upsertSubscription({
  orgId,
  stripeSubscriptionId,
  stripePriceId,
  plan,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd
}) {
  prepare(
    `INSERT INTO subscriptions
       (org_id, stripe_subscription_id, stripe_price_id, plan, status,
        current_period_start, current_period_end, cancel_at_period_end, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(org_id) DO UPDATE SET
       stripe_subscription_id = excluded.stripe_subscription_id,
       stripe_price_id = excluded.stripe_price_id,
       plan = excluded.plan,
       status = excluded.status,
       current_period_start = excluded.current_period_start,
       current_period_end = excluded.current_period_end,
       cancel_at_period_end = excluded.cancel_at_period_end,
       updated_at = datetime('now')`
  ).run(
    orgId,
    stripeSubscriptionId || null,
    stripePriceId || null,
    plan,
    status,
    currentPeriodStart || null,
    currentPeriodEnd || null,
    cancelAtPeriodEnd ? 1 : 0
  );
}

function setOrgPlan(orgId, plan) {
  prepare("UPDATE orgs SET plan = ? WHERE id = ?").run(plan, orgId);
}

function setStripeCustomerId(orgId, customerId) {
  prepare("UPDATE orgs SET stripe_customer_id = ? WHERE id = ?").run(customerId, orgId);
}

function findOrgByCustomerId(customerId) {
  return prepare("SELECT * FROM orgs WHERE stripe_customer_id = ?").get(customerId);
}

function findOrgBySubscriptionId(subscriptionId) {
  const row = prepare(
    "SELECT o.* FROM orgs o JOIN subscriptions s ON s.org_id = o.id WHERE s.stripe_subscription_id = ?"
  ).get(subscriptionId);
  return row || null;
}

module.exports = {
  getSubscription,
  upsertSubscription,
  setOrgPlan,
  setStripeCustomerId,
  findOrgByCustomerId,
  findOrgBySubscriptionId
};
