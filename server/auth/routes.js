const crypto = require("crypto");
const express = require("express");
const { z } = require("zod");

const repo = require("./repo");
const passwords = require("./passwords");
const plans = require("../billing/plans");

const router = express.Router();

const signupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().max(200).optional(),
  orgName: z.string().min(1).max(200).optional()
});

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200)
});

const switchOrgSchema = z.object({
  orgId: z.number().int().positive()
});

const resetRequestSchema = z.object({
  email: z.string().email().max(200)
});

const resetConfirmSchema = z.object({
  token: z.string().min(8).max(200),
  newPassword: z.string().min(8).max(200)
});

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

function publicOrg(org, role) {
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    credits: org.credits_balance,
    role: role || null,
    features: plans.featuresFor(org.plan)
  };
}

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const { email, password, name, orgName } = parsed.data;

  if (repo.findUserByEmail(email)) {
    return res.status(409).json({ error: "email_taken" });
  }

  const passwordHash = await passwords.hash(password);
  const { user, org } = repo.signup({ email, passwordHash, name, orgName });

  req.session.userId = user.id;
  req.session.orgId = org.id;

  res.json({
    user: publicUser(user),
    org: publicOrg(org, "owner"),
    orgs: [publicOrg(org, "owner")]
  });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input" });
  }
  const { email, password } = parsed.data;

  const user = repo.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "invalid_credentials" });
  }
  const ok = await passwords.verify(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const orgs = repo.listOrgsForUser(user.id);
  const org = orgs[0];
  if (!org) {
    return res.status(403).json({ error: "no_org" });
  }

  req.session.userId = user.id;
  req.session.orgId = org.id;

  res.json({
    user: publicUser(user),
    org: publicOrg(org, org.role),
    orgs: orgs.map((o) => publicOrg(o, o.role))
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.json({ authenticated: false });
  const user = repo.findUserById(userId);
  if (!user) return res.json({ authenticated: false });
  const orgs = repo.listOrgsForUser(user.id);
  const org = repo.getActiveOrg({ userId: user.id, orgId: req.session.orgId }) || orgs[0];
  res.json({
    authenticated: true,
    user: publicUser(user),
    org: org ? publicOrg(org, repo.getMembership(org.id, user.id)?.role) : null,
    orgs: orgs.map((o) => publicOrg(o, o.role))
  });
});

router.post("/switch-org", (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const parsed = switchOrgSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const membership = repo.getMembership(parsed.data.orgId, userId);
  if (!membership) return res.status(403).json({ error: "forbidden" });
  req.session.orgId = parsed.data.orgId;
  const org = repo.findOrgById(parsed.data.orgId);
  res.json({ org: publicOrg(org, membership.role) });
});

router.post("/password-reset/request", async (req, res) => {
  const parsed = resetRequestSchema.safeParse(req.body || {});
  if (!parsed.success) return res.json({ ok: true });

  const user = repo.findUserByEmail(parsed.data.email);
  if (!user) {
    return res.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  repo.createPasswordResetToken({ userId: user.id, tokenHash, expiresAt });

  const isProd = process.env.NODE_ENV === "production";
  const link = `${process.env.APP_BASE_URL || "http://localhost:3000"}/reset/${token}`;
  console.log(`[password-reset] user=${user.id} link=${link}`);

  if (!isProd) {
    return res.json({ ok: true, devToken: token, devLink: link });
  }
  res.json({ ok: true });
});

router.post("/password-reset/confirm", async (req, res) => {
  const parsed = resetConfirmSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const row = repo.consumePasswordResetToken(tokenHash);
  if (!row) return res.status(400).json({ error: "invalid_or_expired" });

  const passwordHash = await passwords.hash(parsed.data.newPassword);
  repo.updateUserPassword(row.user_id, passwordHash);
  res.json({ ok: true });
});

module.exports = router;
