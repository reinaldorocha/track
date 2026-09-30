import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensurePasskeyTables } from "@/lib/db/ensure-passkey-tables";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/webauthn/credentials
 * Lists all passkey credentials for the authenticated user.
 *
 * DELETE /api/auth/webauthn/credentials?id=...
 * Removes a specific passkey credential.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await ensurePasskeyTables();

  const rows = await prisma.$queryRawUnsafe<{
    id: string;
    credentialId: string;
    deviceName: string | null;
    deviceType: string | null;
    backedUp: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }[]>(
    `SELECT "id", "credentialId", "deviceName", "deviceType", "backedUp", "lastUsedAt", "createdAt"
     FROM "PasskeyCredential" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    session.user.id
  );

  return NextResponse.json({ credentials: rows });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await ensurePasskeyTables();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID da credencial não informado" }, { status: 400 });
  }

  // Ensure the credential belongs to this user
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "PasskeyCredential" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
    id,
    session.user.id
  );

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Credencial não encontrada" }, { status: 404 });
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM "PasskeyCredential" WHERE "id" = $1 AND "userId" = $2`,
    id,
    session.user.id
  );

  return NextResponse.json({
    success: true,
    message: "Dispositivo removido. A biometria deste dispositivo não será mais aceita.",
  });
}
