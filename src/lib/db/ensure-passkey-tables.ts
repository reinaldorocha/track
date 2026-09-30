import { prisma } from "@/lib/db";

let passkeyTablesEnsured = false;

/**
 * Ensures PasskeyCredential and WebAuthnChallenge tables exist in PostgreSQL (Supabase).
 * Idempotent — safe to call on every request.
 */
export async function ensurePasskeyTables(): Promise<boolean> {
  if (passkeyTablesEnsured) return true;
  try {
    const dbUrl = process.env.DATABASE_URL || "";
    const isPostgres =
      !dbUrl.startsWith("file:") &&
      (dbUrl.startsWith("postgres://") ||
        dbUrl.startsWith("postgresql://") ||
        process.env.NODE_ENV === "production");

    if (isPostgres) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "public"."PasskeyCredential" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "credentialId" TEXT NOT NULL,
          "publicKey" TEXT NOT NULL,
          "counter" BIGINT NOT NULL DEFAULT 0,
          "deviceType" TEXT,
          "deviceName" TEXT,
          "backedUp" BOOLEAN NOT NULL DEFAULT false,
          "transports" TEXT,
          "lastUsedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "PasskeyCredential_credentialId_key"
        ON "public"."PasskeyCredential"("credentialId");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PasskeyCredential_userId_idx"
        ON "public"."PasskeyCredential"("userId");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "public"."WebAuthnChallenge" (
          "id" TEXT NOT NULL,
          "challenge" TEXT NOT NULL,
          "userId" TEXT,
          "type" TEXT NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "WebAuthnChallenge_challenge_key"
        ON "public"."WebAuthnChallenge"("challenge");
      `);
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'PasskeyCredential_userId_fkey'
          ) THEN
            ALTER TABLE "public"."PasskeyCredential"
            ADD CONSTRAINT "PasskeyCredential_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
    } else {
      // SQLite for local dev
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PasskeyCredential" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "credentialId" TEXT NOT NULL UNIQUE,
          "publicKey" TEXT NOT NULL,
          "counter" INTEGER NOT NULL DEFAULT 0,
          "deviceType" TEXT,
          "deviceName" TEXT,
          "backedUp" BOOLEAN NOT NULL DEFAULT 0,
          "transports" TEXT,
          "lastUsedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WebAuthnChallenge" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "challenge" TEXT NOT NULL UNIQUE,
          "userId" TEXT,
          "type" TEXT NOT NULL,
          "expiresAt" DATETIME NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    passkeyTablesEnsured = true;
    return true;
  } catch (err: any) {
    console.warn("[ensurePasskeyTables] Warning:", err?.message || err);
    passkeyTablesEnsured = true;
    return true;
  }
}
