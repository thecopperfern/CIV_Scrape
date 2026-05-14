#!/usr/bin/env node
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { run: runMigrations } = require("../server/db/migrate");
runMigrations();

const repo = require("../server/auth/repo");
const passwords = require("../server/auth/passwords");
const { prepare } = require("../server/db");

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("[seed] ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  let user = repo.findUserByEmail(adminEmail);
  if (!user) {
    const passwordHash = await passwords.hash(adminPassword);
    user = repo.createUser({ email: adminEmail, passwordHash, name: "CIV Admin" });
    console.log(`[seed] created admin user id=${user.id}`);
  } else {
    console.log(`[seed] admin user exists id=${user.id}`);
  }

  let org = prepare("SELECT * FROM orgs WHERE id = 1").get();
  if (!org) {
    const result = prepare(
      "INSERT INTO orgs(id, name, slug, plan, credits_balance) VALUES (1, ?, ?, 'agency', 0)"
    ).run("CIV Enterprises", "civ");
    org = prepare("SELECT * FROM orgs WHERE id = ?").get(result.lastInsertRowid);
    console.log(`[seed] created CIV org id=${org.id}`);
  } else {
    console.log(`[seed] CIV org exists id=${org.id}`);
  }

  repo.addMember({ orgId: org.id, userId: user.id, role: "owner" });
  console.log(`[seed] ensured membership: user=${user.id} org=${org.id} role=owner`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
