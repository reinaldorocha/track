import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (key && key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  
  // Resilient derivation from server secret if 64-hex key is not directly configured
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "utm_track_production_master_encryption_key_2025";
  return crypto.createHash("sha256").update(secret).digest();
}


/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 encoded string: IV + AuthTag + CipherText
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV (16) + AuthTag (16) + CipherText
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt a base64 encoded string encrypted with encrypt().
 */
export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const combined = Buffer.from(encryptedBase64, "base64");
  
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  
  return decrypted.toString("utf8");
}

/**
 * Mask a sensitive string for display: show only last 4 chars.
 * e.g., "EAABw..." → "••••••••••••B1c2"
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length <= 4) return "••••";
  return "••••••••••••" + secret.slice(-4);
}

/**
 * Hash a string with SHA-256 (for Meta CAPI user data requirements).
 */
export function sha256Hash(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
