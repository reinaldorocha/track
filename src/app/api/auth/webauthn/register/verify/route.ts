import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  consumeChallenge,
  verifyRegistrationResponse,
} from "@/lib/auth/webauthn";
import { ensurePasskeyTables } from "@/lib/db/ensure-passkey-tables";

/**
 * POST /api/auth/webauthn/register/verify
 * Verifies a registration ceremony and persists the new passkey credential.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await ensurePasskeyTables();

  let body: {
    rawId: string;
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
    deviceName?: string;
    challenge: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { challenge, rawId, clientDataJSON, attestationObject, transports, deviceName } = body;

  if (!challenge || !rawId || !clientDataJSON || !attestationObject) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  // 1. Consume challenge (one-time use, replay protection)
  const challengeResult = await consumeChallenge(challenge);
  if (!challengeResult.valid) {
    return NextResponse.json({ error: "Challenge inválido ou expirado" }, { status: 400 });
  }

  if (challengeResult.userId && challengeResult.userId !== session.user.id) {
    return NextResponse.json({ error: "Challenge pertence a outro usuário" }, { status: 403 });
  }

  // 2. Verify the attestation
  const verifyResult = await verifyRegistrationResponse({
    rawId,
    clientDataJSON,
    attestationObject,
    transports,
    challenge,
    userId: session.user.id,
    deviceName,
  });

  if (!verifyResult.ok) {
    console.error("[WebAuthn Register] Verification failed:", verifyResult.error);
    return NextResponse.json(
      { error: verifyResult.error || "Verificação falhou" },
      { status: 400 }
    );
  }

  // 3. Persist credential
  const credId = crypto.randomUUID();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "PasskeyCredential"
      ("id", "userId", "credentialId", "publicKey", "counter", "deviceName", "backedUp", "transports", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    ON CONFLICT ("credentialId") DO UPDATE SET
      "counter" = $5, "updatedAt" = NOW()
  `,
    credId,
    session.user.id,
    verifyResult.credentialId!,
    verifyResult.publicKey!,
    verifyResult.counter ?? 0,
    deviceName || "Dispositivo",
    verifyResult.backedUp ?? false,
    JSON.stringify(verifyResult.transports || [])
  );

  return NextResponse.json({
    success: true,
    message: "Biometria registrada com sucesso neste dispositivo!",
  });
}
