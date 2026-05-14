const express = require("express");
const { getStripe } = require("./stripe");
const { prepare, tx } = require("../db");
const plans = require("./plans");
const subscriptions = require("./subscriptions");
const credits = require("./credits");

const router = express.Router();

function tsToISO(unixSec) {
  if (!unixSec) return null;
  return new Date(unixSec * 1000).toISOString();
}

const recordEvent = tx(({ stripeEventId, type, orgId, payload }) => {
  const result = prepare(
    `INSERT OR IGNORE INTO billing_events(stripe_event_id, type, org_id, payload_json)
     VALUES (?, ?, ?, ?)`
  ).run(stripeEventId, type, orgId || null, JSON.stringify(payload));
  return result.changes > 0;
});

function orgIdFromObject(obj) {
  const metaOrg = obj?.metadata?.org_id;
  if (metaOrg) return Number(metaOrg);
  const customerId = obj?.customer;
  if (customerId) {
    const org = subscriptions.findOrgByCustomerId(customerId);
    if (org) return org.id;
  }
  return null;
}

function applySubscription(sub) {
  const orgId = orgIdFromObject(sub);
  if (!orgId) return;
  const priceId = sub.items?.data?.[0]?.price?.id || null;
  const plan = plans.planFromStripePriceId(priceId) || "free";
  subscriptions.upsertSubscription({
    orgId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    plan,
    status: sub.status,
    currentPeriodStart: tsToISO(sub.current_period_start),
    currentPeriodEnd: tsToISO(sub.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end)
  });
  if (["active", "trialing", "past_due"].includes(sub.status)) {
    subscriptions.setOrgPlan(orgId, plan);
  }
  if (sub.status === "canceled") {
    subscriptions.setOrgPlan(orgId, "free");
  }
}

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).send("webhook_secret_not_configured");

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.warn(`[stripe-webhook] signature failure: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const orgId = orgIdFromObject(event.data?.object || {});

  const inserted = recordEvent({
    stripeEventId: event.id,
    type: event.type,
    orgId,
    payload: event
  });

  if (!inserted) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const obj = event.data.object;
        if (obj.mode === "payment" && obj.metadata?.kind === "credit_pack") {
          const orgIdFromMeta = Number(obj.metadata.org_id);
          const creditsAmount = Number(obj.metadata.credits);
          if (orgIdFromMeta && creditsAmount > 0) {
            credits.addCredits({
              orgId: orgIdFromMeta,
              qty: creditsAmount,
              reason: "purchase",
              stripeEventId: event.id
            });
          }
        } else if (obj.mode === "subscription" && obj.subscription) {
          const sub = await getStripe().subscriptions.retrieve(obj.subscription);
          if (sub) applySubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        applySubscription(event.data.object);
        break;
      }
      case "invoice.payment_failed": {
        const orgIdInvoice = orgIdFromObject(event.data.object);
        if (orgIdInvoice) {
          prepare(
            "UPDATE subscriptions SET status = 'past_due', updated_at = datetime('now') WHERE org_id = ?"
          ).run(orgIdInvoice);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler error: ${err.message}`);
    return res.status(500).send("handler_error");
  }

  res.json({ received: true });
});

module.exports = router;
