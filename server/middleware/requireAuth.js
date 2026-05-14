const repo = require("../auth/repo");

function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const user = repo.findUserById(userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "unauthorized" });
  }

  const org = repo.getActiveOrg({ userId, orgId: req.session?.orgId });
  if (!org) {
    return res.status(403).json({ error: "no_org" });
  }

  if (req.session.orgId !== org.id) {
    req.session.orgId = org.id;
  }

  req.user = user;
  req.org = org;
  req.role = repo.getMembership(org.id, user.id)?.role || "member";
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
