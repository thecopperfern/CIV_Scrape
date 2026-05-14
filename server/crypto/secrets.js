const crypto = require("crypto");

const VERSION = 1;
const KEY_INFO = "pf-integrations-v1";

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const material = process.env.APP_ENCRYPTION_KEY;
  if (!material) {
    throw new Error("APP_ENCRYPTION_KEY is required to encrypt/decrypt secrets");
  }
  cachedKey = crypto.scryptSync(material, KEY_INFO, 32);
  return cachedKey;
}

function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ct]);
}

function decrypt(blob) {
  if (!Buffer.isBuffer(blob)) blob = Buffer.from(blob);
  const version = blob[0];
  if (version !== VERSION) throw new Error(`Unsupported encryption version: ${version}`);
  const iv = blob.slice(1, 13);
  const tag = blob.slice(13, 29);
  const ct = blob.slice(29);
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

function encryptJson(obj) {
  return encrypt(JSON.stringify(obj));
}

function decryptJson(blob) {
  try {
    return JSON.parse(decrypt(blob));
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt, encryptJson, decryptJson };
