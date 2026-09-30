import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createChallenge,
  getRpConfig,
} from "@/lib/auth/webauthn";
import { ensurePasskeyTables } from "@/lib/db/ensure-passkey-tables";

/**
 * GET /api/auth/webauthn/register
 * Returns a registration challenge for the authenticated user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await ensurePasskeyTables();

  const { rpId, rpName, origin } = getRpConfig();
  const challenge = await createChallenge("registration", session.user.id);

  // Fetch user info
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // Fetch existing credentials so browser can exclude them
  const existingCredentials = await prisma.$queryRawUnsafe<{ credentialId: string; transports: string | null }[]>(
    `SELECT "credentialId", "transports" FROM "PasskeyCredential" WHERE "userId" = $1`,
    session.user.id
  );

  const excludeCredentials = existingCredentials.map((c) => ({
    id: c.credentialId,
    type: "public-key",
    transports: c.transports ? JSON.parse(c.transports) : ["internal"],
  }));

  const options = {
    challenge,
    rp: { id: rpId, name: rpName },
    user: {
      id: Buffer.from(user.id).toString("base64url"),
      name: user.email || user.id,
      displayName: user.name || user.email || "Usuário UTM-Track",
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" },   // ES256 (ECDSA P-256) — preferred
      { alg: -257, type: "public-key" }, // RS256 (RSA PKCS1)
    ],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform", // biometrics only (fingerprint / Face ID)
      requireResidentKey: false,
      userVerification: "required",
    },
    excludeCredentials,
  };

  return NextResponse.json({ options });
}
