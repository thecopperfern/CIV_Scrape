const bcrypt = require("bcryptjs");

const COST = 12;

async function hash(plain) {
  return bcrypt.hash(String(plain), COST);
}

async function verify(plain, hashed) {
  if (!plain || !hashed) return false;
  return bcrypt.compare(String(plain), String(hashed));
}

module.exports = { hash, verify };
