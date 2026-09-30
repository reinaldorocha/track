import { NextResponse } from "next/server";
import { createChallenge, getRpConfig } from "@/lib/auth/webauthn";
import { ensurePasskeyTables } from "@/lib/db/ensure-passkey-tables";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/webauthn/authenticate
 * Returns authentication options (challenge + allowed credentials) for login.
 * No session required — this is for unauthenticated login.
 */
export async function GET() {
  await ensurePasskeyTables();

  const { rpId } = getRpConfig();
  const challenge = await createChallenge("authentication");

  // Return options without specifying allowCredentials so the authenticator
  // can present any stored credential for this RP (discoverable credentials / resident keys)
  const options = {
    challenge,
    rpId,
    timeout: 60000,
    userVerification: "required",
    allowCredentials: [], // empty = any credential for this RP
  };

  return NextResponse.json({ options });
}
