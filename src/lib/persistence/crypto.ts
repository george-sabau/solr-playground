import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Dev-only fallback when SOLR_PLAYGROUND_SECRET is unset.
 * Do not use in production — set SOLR_PLAYGROUND_SECRET to a long random string.
 */
const DEV_FALLBACK_SECRET =
  "solr-playground-dev-only-not-for-production-change-me";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encryptionKey(): Buffer {
  const secret =
    process.env.SOLR_PLAYGROUND_SECRET?.trim() || DEV_FALLBACK_SECRET;
  return createHash("sha256").update(secret, "utf8").digest();
}

/** AES-256-GCM ciphertext as base64(iv || authTag || ciphertext). */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  if (!payload) return "";
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function isUsingDevFallbackSecret(): boolean {
  return !process.env.SOLR_PLAYGROUND_SECRET?.trim();
}
