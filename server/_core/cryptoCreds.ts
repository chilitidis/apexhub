import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM symmetric encryption helpers for storing MT5 broker passwords.
 *
 * Key derivation
 *   key = SHA-256( JWT_SECRET || "::mt5-credentials::v1" )
 *
 * We deliberately reuse JWT_SECRET because it is already required for the
 * web app (sessions are unusable without it) and so this module fails fast
 * in any deployment that lacks proper secrets configuration. There is no
 * fallback to a hard-coded key — production refusal is the safe behaviour.
 *
 * Wire format (single base64 string, easier to store in TEXT columns):
 *   layout = iv(12 bytes) || tag(16 bytes) || ciphertext(*)
 *
 * Notes
 *   - GCM gives authenticated encryption, so tampering is detected on decrypt.
 *   - A fresh 12-byte random IV is generated per call. With 128-bit IVs the
 *     birthday bound is ~2^48 messages before any meaningful collision risk —
 *     orders of magnitude beyond what a single user will ever produce.
 */

const KEY_INFO = "::mt5-credentials::v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 16) {
    throw new Error(
      "MT5 credential encryption requires JWT_SECRET to be at least 16 characters",
    );
  }
  return createHash("sha256").update(secret).update(KEY_INFO).digest();
}

export function encryptPassword(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("encryptPassword: plaintext must be a string");
  }
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptPassword(payload: string): string {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new Error("decryptPassword: payload must be a non-empty string");
  }
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error("decryptPassword: ciphertext is too short to be valid");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);
  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString("utf8");
}
