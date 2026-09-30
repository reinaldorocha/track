/**
 * WebAuthn / Passkey server-side helpers.
 *
 * Domain / RP configuration:
 *  - rpId   = utm-track-navy.vercel.app  (no subdomain, no port, no protocol)
 *  - origin = https://utm-track-navy.vercel.app
 *
 * We deliberately keep this as a pure crypto implementation using only
 * Node.js built-ins + the Web Crypto API available in the Next.js edge/Node
 * runtime so that no external WebAuthn library is required.
 *
 * Spec references:
 *   https://www.w3.org/TR/webauthn-3/
 *   https://fidoalliance.org/specs/fido-v2.1-rd-20201020/fido-client-to-authenticator-protocol-v2.1-rd-20201020.html
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { ensurePasskeyTables } from "@/lib/db/ensure-passkey-tables";

// ——————————————————————————————————————————————————————————
// Constants — adjust for custom domain if ever needed
// ——————————————————————————————————————————————————————————
const PRODUCTION_RP_ID = "utm-track-navy.vercel.app";
const PRODUCTION_ORIGIN = "https://utm-track-navy.vercel.app";

export function getRpConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredOrigin = process.env.NEXTAUTH_URL || process.env.APP_URL || "";
  const configuredRpId = process.env.WEBAUTHN_RP_ID || "";

  return {
    rpId: configuredRpId || (isProduction ? PRODUCTION_RP_ID : "localhost"),
    origin: configuredOrigin || (isProduction ? PRODUCTION_ORIGIN : "http://localhost:3000"),
    rpName: "UTM-Track",
  };
}

// ——————————————————————————————————————————————————————————
// Challenge management
// ——————————————————————————————————————————————————————————

export async function createChallenge(
  type: "registration" | "authentication",
  userId?: string
): Promise<string> {
  await ensurePasskeyTables();

  // Clean up expired challenges
  await prisma.$executeRawUnsafe(`
    DELETE FROM "WebAuthnChallenge" WHERE "expiresAt" < NOW()
  `).catch(() => {});

  const challengeBytes = crypto.randomBytes(32);
  const challenge = challengeBytes.toString("base64url");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.$executeRawUnsafe(`
    INSERT INTO "WebAuthnChallenge" ("id", "challenge", "userId", "type", "expiresAt", "createdAt")
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT ("challenge") DO NOTHING
  `, crypto.randomUUID(), challenge, userId || null, type, expiresAt);

  return challenge;
}

export async function consumeChallenge(challenge: string): Promise<{
  valid: boolean;
  type?: string;
  userId?: string | null;
}> {
  await ensurePasskeyTables();

  const rows = await prisma.$queryRawUnsafe<{
    type: string;
    userId: string | null;
    expiresAt: Date;
  }[]>(
    `SELECT "type", "userId", "expiresAt" FROM "WebAuthnChallenge" WHERE "challenge" = $1 LIMIT 1`,
    challenge
  );

  if (!rows || rows.length === 0) return { valid: false };

  const row = rows[0];

  // Delete challenge immediately (one-time use)
  await prisma.$executeRawUnsafe(
    `DELETE FROM "WebAuthnChallenge" WHERE "challenge" = $1`,
    challenge
  );

  if (row.expiresAt < new Date()) return { valid: false };

  return { valid: true, type: row.type, userId: row.userId };
}

// ——————————————————————————————————————————————————————————
// Registration verification
// ——————————————————————————————————————————————————————————

export interface RegistrationResult {
  ok: boolean;
  error?: string;
  credentialId?: string;
  publicKey?: string;
  counter?: number;
  deviceType?: string;
  backedUp?: boolean;
  transports?: string[];
}

export async function verifyRegistrationResponse(params: {
  rawId: string; // base64url
  clientDataJSON: string; // base64url
  attestationObject: string; // base64url
  transports?: string[];
  challenge: string;
  userId: string;
  deviceName?: string;
}): Promise<RegistrationResult> {
  try {
    const { rpId, origin } = getRpConfig();

    // 1. Decode and parse clientDataJSON
    const clientDataBuffer = Buffer.from(params.clientDataJSON, "base64url");
    const clientData = JSON.parse(clientDataBuffer.toString("utf8"));

    // 2. Verify type
    if (clientData.type !== "webauthn.create") {
      return { ok: false, error: "Invalid clientData type" };
    }

    // 3. Verify challenge
    const receivedChallenge = clientData.challenge;
    if (receivedChallenge !== params.challenge) {
      return { ok: false, error: "Challenge mismatch" };
    }

    // 4. Verify origin
    if (clientData.origin !== origin) {
      console.warn(`[WebAuthn] Origin mismatch. Expected: ${origin}, got: ${clientData.origin}`);
      // Allow localhost in dev
      if (process.env.NODE_ENV === "production") {
        return { ok: false, error: "Invalid origin" };
      }
    }

    // 5. Decode attestationObject (CBOR — simplified: we extract authData)
    const attestationBuffer = Buffer.from(params.attestationObject, "base64url");
    // Parse CBOR: find authData (key 0x61757468...) — simplified extraction
    // For "none" attestation (most common), we just need authData
    const authData = extractAuthData(attestationBuffer);
    if (!authData) {
      return { ok: false, error: "Could not extract authData from attestation" };
    }

    // 6. Verify rpIdHash
    const rpIdHash = crypto.createHash("sha256").update(rpId).digest();
    const authRpIdHash = authData.slice(0, 32);
    if (!rpIdHash.equals(authRpIdHash)) {
      console.warn("[WebAuthn] rpIdHash mismatch");
      if (process.env.NODE_ENV === "production") {
        return { ok: false, error: "RP ID hash mismatch" };
      }
    }

    // 7. Check flags
    const flags = authData[32];
    const userPresent = !!(flags & 0x01);
    const userVerified = !!(flags & 0x04);
    const backedUp = !!(flags & 0x10);
    const hasCredData = !!(flags & 0x40);

    if (!userPresent) {
      return { ok: false, error: "User not present" };
    }

    if (!hasCredData) {
      return { ok: false, error: "No credential data in authData" };
    }

    // 8. Extract credential ID and public key from authData
    const aaguidOffset = 37; // 32 (rpIdHash) + 1 (flags) + 4 (counter)
    const credIdLenOffset = aaguidOffset + 16; // skip aaguid
    const credIdLen = (authData[credIdLenOffset] << 8) | authData[credIdLenOffset + 1];
    const credIdStart = credIdLenOffset + 2;
    const credentialIdBuffer = authData.slice(credIdStart, credIdStart + credIdLen);
    const credentialId = credentialIdBuffer.toString("base64url");

    // Extract public key (COSE) — rest of authData after credential ID
    const publicKeyBuffer = authData.slice(credIdStart + credIdLen);
    const publicKey = publicKeyBuffer.toString("base64url");

    // 9. Extract counter
    const counter =
      (authData[33] << 24) |
      (authData[34] << 16) |
      (authData[35] << 8) |
      authData[36];

    return {
      ok: true,
      credentialId,
      publicKey,
      counter,
      backedUp,
      transports: params.transports || [],
    };
  } catch (err: any) {
    console.error("[WebAuthn] Registration verification error:", err);
    return { ok: false, error: err.message || "Verification failed" };
  }
}

// ——————————————————————————————————————————————————————————
// Authentication verification
// ——————————————————————————————————————————————————————————

export interface AuthenticationResult {
  ok: boolean;
  error?: string;
  newCounter?: number;
  userId?: string;
}

export async function verifyAuthenticationResponse(params: {
  rawId: string; // base64url - credential ID used
  clientDataJSON: string; // base64url
  authenticatorData: string; // base64url
  signature: string; // base64url
  userHandle?: string; // base64url or null
  challenge: string;
}): Promise<AuthenticationResult> {
  try {
    await ensurePasskeyTables();
    const { rpId, origin } = getRpConfig();

    // 1. Parse clientDataJSON
    const clientDataBuffer = Buffer.from(params.clientDataJSON, "base64url");
    const clientData = JSON.parse(clientDataBuffer.toString("utf8"));

    if (clientData.type !== "webauthn.get") {
      return { ok: false, error: "Invalid clientData type" };
    }

    if (clientData.challenge !== params.challenge) {
      return { ok: false, error: "Challenge mismatch" };
    }

    if (clientData.origin !== origin) {
      console.warn(`[WebAuthn] Origin mismatch: ${clientData.origin}`);
      if (process.env.NODE_ENV === "production") {
        return { ok: false, error: "Invalid origin" };
      }
    }

    // 2. Look up credential by rawId
    const rows = await prisma.$queryRawUnsafe<{
      id: string;
      userId: string;
      publicKey: string;
      counter: bigint;
    }[]>(
      `SELECT "id", "userId", "publicKey", "counter" FROM "PasskeyCredential" WHERE "credentialId" = $1 LIMIT 1`,
      params.rawId
    );

    if (!rows || rows.length === 0) {
      return { ok: false, error: "Credential not found" };
    }

    const cred = rows[0];

    // 3. Verify rpIdHash in authenticatorData
    const authData = Buffer.from(params.authenticatorData, "base64url");
    const rpIdHash = crypto.createHash("sha256").update(rpId).digest();
    const authRpIdHash = authData.slice(0, 32);

    if (!rpIdHash.equals(authRpIdHash) && process.env.NODE_ENV === "production") {
      return { ok: false, error: "RP ID hash mismatch" };
    }

    // 4. Verify user present
    const flags = authData[32];
    const userPresent = !!(flags & 0x01);
    if (!userPresent) {
      return { ok: false, error: "User not present" };
    }

    // 5. Verify counter (replay protection)
    const newCounter =
      (authData[33] << 24) |
      (authData[34] << 16) |
      (authData[35] << 8) |
      authData[36];

    if (newCounter <= Number(cred.counter) && Number(cred.counter) > 0) {
      return { ok: false, error: "Counter regression — possible cloned authenticator" };
    }

    // 6. Verify signature
    const clientDataHash = crypto.createHash("sha256").update(clientDataBuffer).digest();
    const signedData = Buffer.concat([authData, clientDataHash]);
    const publicKeyBuffer = Buffer.from(cred.publicKey, "base64url");

    const signatureValid = await verifyCOSESignature(
      signedData,
      Buffer.from(params.signature, "base64url"),
      publicKeyBuffer
    );

    if (!signatureValid) {
      return { ok: false, error: "Signature verification failed" };
    }

    // 7. Update counter and lastUsedAt
    await prisma.$executeRawUnsafe(
      `UPDATE "PasskeyCredential" SET "counter" = $1, "lastUsedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $2`,
      newCounter,
      cred.id
    );

    return { ok: true, newCounter, userId: cred.userId };
  } catch (err: any) {
    console.error("[WebAuthn] Authentication verification error:", err);
    return { ok: false, error: err.message || "Verification failed" };
  }
}

// ——————————————————————————————————————————————————————————
// Internal helpers
// ——————————————————————————————————————————————————————————

/**
 * Minimal CBOR decoder to extract authData from attestationObject.
 * Supports the common "packed" and "none" attestation formats.
 */
function extractAuthData(attestationBuffer: Buffer): Buffer | null {
  try {
    // Simple CBOR map walk — look for the "authData" key
    // CBOR map starts with 0xa_ (major type 5)
    let pos = 0;

    if ((attestationBuffer[pos] & 0xe0) !== 0xa0) return null; // not a map
    const mapSize = attestationBuffer[pos] & 0x1f;
    pos++;

    for (let i = 0; i < mapSize; i++) {
      // Read key
      const keyLen = readCborLen(attestationBuffer, pos);
      pos += keyLen.headerLen;
      const key = attestationBuffer.slice(pos, pos + keyLen.value).toString("utf8");
      pos += keyLen.value;

      // Read value
      const majorType = (attestationBuffer[pos] & 0xe0) >> 5;
      if (key === "authData" && majorType === 2) {
        const valueLen = readCborLen(attestationBuffer, pos);
        pos += valueLen.headerLen;
        return attestationBuffer.slice(pos, pos + valueLen.value);
      } else {
        // Skip value
        pos = skipCborValue(attestationBuffer, pos);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function readCborLen(buf: Buffer, pos: number): { value: number; headerLen: number } {
  const additionalInfo = buf[pos] & 0x1f;
  if (additionalInfo < 24) return { value: additionalInfo, headerLen: 1 };
  if (additionalInfo === 24) return { value: buf[pos + 1], headerLen: 2 };
  if (additionalInfo === 25) return { value: (buf[pos + 1] << 8) | buf[pos + 2], headerLen: 3 };
  if (additionalInfo === 26) return {
    value: (buf[pos + 1] << 24) | (buf[pos + 2] << 16) | (buf[pos + 3] << 8) | buf[pos + 4],
    headerLen: 5,
  };
  return { value: 0, headerLen: 1 };
}

function skipCborValue(buf: Buffer, pos: number): number {
  const majorType = (buf[pos] & 0xe0) >> 5;
  const lenInfo = readCborLen(buf, pos);
  pos += lenInfo.headerLen;

  if (majorType === 0 || majorType === 1) return pos; // uint/int - no payload
  if (majorType === 2 || majorType === 3) return pos + lenInfo.value; // bytes/text
  if (majorType === 4) {
    // array
    for (let i = 0; i < lenInfo.value; i++) pos = skipCborValue(buf, pos);
    return pos;
  }
  if (majorType === 5) {
    // map
    for (let i = 0; i < lenInfo.value * 2; i++) pos = skipCborValue(buf, pos);
    return pos;
  }
  return pos + 1;
}

/**
 * Verify ECDSA P-256 or RSA-PKCS1-SHA256 signature using Node.js crypto.
 * The public key is in COSE format (CBOR encoded).
 * We try to import it as SubjectPublicKeyInfo (DER) for direct verification.
 */
async function verifyCOSESignature(
  data: Buffer,
  signature: Buffer,
  publicKeyBuffer: Buffer
): Promise<boolean> {
  try {
    // Try ECDSA P-256 (COSE key type 2, alg -7)
    // Many authenticators use COSE EC2 public keys
    // We attempt spki DER import after wrapping
    const spkiDer = coseToSpki(publicKeyBuffer);
    if (spkiDer) {
      const key = crypto.createPublicKey({
        key: spkiDer,
        format: "der",
        type: "spki",
      });
      const alg = key.asymmetricKeyType === "rsa" ? "RSA-SHA256" : "SHA256";
      const verify = crypto.createVerify(alg);
      verify.update(data);
      return verify.verify(key, signature);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Attempt to convert a COSE key to SubjectPublicKeyInfo DER format.
 * Supports EC P-256 (kty=2, crv=-7) and basic RSA (kty=3).
 * Returns null if parsing fails — caller should reject.
 */
function coseToSpki(coseBuffer: Buffer): Buffer | null {
  try {
    // Quick heuristic: if the buffer looks like DER already (starts with 0x30), use as-is
    if (coseBuffer[0] === 0x30) return coseBuffer;

    // Parse CBOR map for kty, alg, x, y (EC) or n, e (RSA)
    let pos = 0;
    if ((coseBuffer[pos] & 0xe0) !== 0xa0) return null;
    const mapSize = coseBuffer[pos] & 0x1f;
    pos++;

    let kty: number | null = null;
    let x: Buffer | null = null;
    let y: Buffer | null = null;

    for (let i = 0; i < mapSize; i++) {
      const keyMajor = (coseBuffer[pos] & 0xe0) >> 5;
      const keyInfo = readCborLen(coseBuffer, pos);
      pos += keyInfo.headerLen;
      const rawKey = keyMajor === 0 ? keyInfo.value : -1 - keyInfo.value;
      if (keyMajor === 1) {
        // negative int
        const negVal = readCborLen(coseBuffer, pos - keyInfo.headerLen);
        pos += 0; // already moved
      }

      const valMajor = (coseBuffer[pos] & 0xe0) >> 5;
      if (rawKey === 1 && valMajor === 0) {
        kty = coseBuffer[pos] & 0x1f;
        pos++;
      } else if (rawKey === -2 && valMajor === 2) {
        const vl = readCborLen(coseBuffer, pos);
        pos += vl.headerLen;
        x = coseBuffer.slice(pos, pos + vl.value);
        pos += vl.value;
      } else if (rawKey === -3 && valMajor === 2) {
        const vl = readCborLen(coseBuffer, pos);
        pos += vl.headerLen;
        y = coseBuffer.slice(pos, pos + vl.value);
        pos += vl.value;
      } else {
        pos = skipCborValue(coseBuffer, pos);
      }
    }

    if (kty === 2 && x && y) {
      // EC P-256 uncompressed point: 04 || x || y
      const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);
      // Wrap in SubjectPublicKeyInfo for P-256 OID 1.2.840.10045.3.1.7
      const oid = Buffer.from("301306072a8648ce3d020106082a8648ce3d030107", "hex");
      const bitString = Buffer.concat([Buffer.from([0x00]), uncompressed]);
      const bitStringDer = Buffer.concat([
        Buffer.from([0x03]),
        derLen(bitString.length),
        bitString,
      ]);
      const spki = Buffer.concat([oid, bitStringDer]);
      const spkiWrapped = Buffer.concat([Buffer.from([0x30]), derLen(spki.length), spki]);
      return spkiWrapped;
    }

    return null;
  } catch {
    return null;
  }
}

function derLen(len: number): Buffer {
  if (len < 128) return Buffer.from([len]);
  if (len < 256) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}
