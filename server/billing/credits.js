const { db, prepare, tx } = require("../db");

class InsufficientCredits extends Error {
  constructor(message) {
    super(message || "insufficient_credits");
    this.code = "INSUFFICIENT_CREDITS";
  }
}

const debit = tx(({ orgId, qty, jobId, stripeEventId, reason }) => {
  const row = prepare(
    "UPDATE orgs SET credits_balance = credits_balance - ? WHERE id = ? AND credits_balance >= ? RETURNING credits_balance"
  ).get(qty, orgId, qty);
  if (!row) throw new InsufficientCredits();
  prepare(
    `INSERT INTO credit_ledger(org_id, delta, reason, job_id, stripe_event_id, balance_after)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(orgId, -qty, reason || "enrichment", jobId || null, stripeEventId || null, row.credits_balance);
  return row.credits_balance;
});

const credit = tx(({ orgId, qty, reason, stripeEventId, jobId }) => {
  const row = prepare(
    "UPDATE orgs SET credits_balance = credits_balance + ? WHERE id = ? RETURNING credits_balance"
  ).get(qty, orgId);
  if (!row) throw new Error("org_not_found");
  prepare(
    `INSERT INTO credit_ledger(org_id, delta, reason, job_id, stripe_event_id, balance_after)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(orgId, qty, reason || "purchase", jobId || null, stripeEventId || null, row.credits_balance);
  return row.credits_balance;
});

function debitCredits({ orgId, qty, jobId, stripeEventId, reason }) {
  if (!qty || qty <= 0) return null;
  return debit({ orgId, qty, jobId, stripeEventId, reason });
}

function addCredits({ orgId, qty, reason, stripeEventId, jobId }) {
  if (!qty || qty <= 0) return null;
  return credit({ orgId, qty, reason, stripeEventId, jobId });
}

function getBalance(orgId) {
  const row = prepare("SELECT credits_balance FROM orgs WHERE id = ?").get(orgId);
  return row?.credits_balance || 0;
}

function ledger(orgId, { limit = 50, offset = 0 } = {}) {
  return prepare(
    "SELECT * FROM credit_ledger WHERE org_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(orgId, Math.min(limit, 200), offset);
}

module.exports = {
  debitCredits,
  addCredits,
  getBalance,
  ledger,
  InsufficientCredits
};
