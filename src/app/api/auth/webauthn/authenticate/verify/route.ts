import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeChallenge, verifyAuthenticationResponse } from "@/lib/auth/webauthn";
import { ensurePasskeyTables } from "@/lib/db/ensure-passkey-tables";
import { encode } from "next-auth/jwt";

/**
 * POST /api/auth/webauthn/authenticate/verify
 * Verifies an authentication ceremony and issues a session JWT cookie.
 *
 * The response sets the same session cookie that NextAuth uses, so the
 * browser transitions to the authenticated state without a second round-trip.
 */
export async function POST(req: Request) {
  await ensurePasskeyTables();

  let body: {
    rawId: string;
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
    challenge: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { challenge, rawId, clientDataJSON, authenticatorData, signature, userHandle } = body;

  if (!challenge || !rawId || !clientDataJSON || !authenticatorData || !signature) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  // 1. Consume challenge (replay protection)
  const challengeResult = await consumeChallenge(challenge);
  if (!challengeResult.valid) {
    return NextResponse.json({ error: "Challenge inválido ou expirado" }, { status: 400 });
  }

  // 2. Verify assertion
  const verifyResult = await verifyAuthenticationResponse({
    rawId,
    clientDataJSON,
    authenticatorData,
    signature,
    userHandle,
    challenge,
  });

  if (!verifyResult.ok) {
    console.error("[WebAuthn Auth] Verification failed:", verifyResult.error);
    return NextResponse.json(
      { error: verifyResult.error || "Autenticação biométrica falhou" },
      { status: 401 }
    );
  }

  const userId = verifyResult.userId;
  if (!userId) {
    return NextResponse.json({ error: "Usuário não encontrado na credencial" }, { status: 401 });
  }

  // 3. Load user from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, status: true, image: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const status = String(user.status || "ACTIVE").toUpperCase();
  if (status === "SUSPENDED" || status === "DISABLED") {
    return NextResponse.json(
      { error: "Conta suspensa. Entre em contato com o administrador." },
      { status: 403 }
    );
  }

  // 4. Update lastLoginAt
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  }).catch(() => {});

  // 5. Create a NextAuth-compatible JWT so the browser picks it up as a session
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "utm-track-jwt-production-secret-auth-key-2025-at-least-32-chars";
  const tokenPayload = {
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "CLIENT",
    status: user.status || "ACTIVE",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
  };

  let sessionToken: string;
  sessionToken = await encode({
    token: tokenPayload,
    secret,
    salt: "authjs.session-token",
  });

  const isSecure = process.env.NODE_ENV === "production";
  const cookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";

  const response = NextResponse.json({
    success: true,
    message: "Autenticação biométrica realizada com sucesso!",
    redirectTo: "/dashboard",
  });

  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
