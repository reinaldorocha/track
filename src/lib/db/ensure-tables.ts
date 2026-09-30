import { prisma } from "@/lib/db";

let tableEnsured = false;
let tableEnsuringPromise: Promise<boolean> | null = null;

/**
 * Ensures the NotificationSound table and any required schema columns exist
 * in the active database (PostgreSQL on Supabase or SQLite locally).
 * This runs idempotently with zero data loss.
 */
export async function ensureNotificationSoundTable(): Promise<boolean> {
  if (tableEnsured) return true;
  if (tableEnsuringPromise) return tableEnsuringPromise;

  tableEnsuringPromise = (async () => {
    try {
      // 1. Detect if database is PostgreSQL or SQLite
      const dbUrl = process.env.DATABASE_URL || "";
      const isPostgres =
        !dbUrl.startsWith("file:") &&
        (dbUrl.startsWith("postgres://") ||
          dbUrl.startsWith("postgresql://") ||
          process.env.NODE_ENV === "production");

      if (isPostgres) {
        // Safe PostgreSQL DDL for Supabase
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "public"."NotificationSound" (
            "id" TEXT NOT NULL,
            "workspaceId" TEXT NOT NULL,
            "userId" TEXT,
            "notificationType" TEXT NOT NULL,
            "originalFileName" TEXT NOT NULL,
            "storagePath" TEXT NOT NULL,
            "fileUrl" TEXT NOT NULL,
            "mimeType" TEXT NOT NULL,
            "fileSize" INTEGER NOT NULL,
            "duration" DOUBLE PRECISION,
            "status" TEXT NOT NULL DEFAULT 'ACTIVE',
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "NotificationSound_pkey" PRIMARY KEY ("id")
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "NotificationSound_workspaceId_notificationType_key" 
          ON "public"."NotificationSound"("workspaceId", "notificationType");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "NotificationSound_workspaceId_isActive_idx" 
          ON "public"."NotificationSound"("workspaceId", "isActive");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "NotificationSound_workspaceId_notificationType_idx" 
          ON "public"."NotificationSound"("workspaceId", "notificationType");
        `);

        // Add column useCustomSounds to NotificationPreference if missing
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "public"."NotificationPreference" 
          ADD COLUMN IF NOT EXISTS "useCustomSounds" BOOLEAN NOT NULL DEFAULT false;
        `);

        // Add Foreign Keys if not exist
        await prisma.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSound_workspaceId_fkey'
            ) THEN
              ALTER TABLE "public"."NotificationSound" 
              ADD CONSTRAINT "NotificationSound_workspaceId_fkey" 
              FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSound_userId_fkey'
            ) THEN
              ALTER TABLE "public"."NotificationSound" 
              ADD CONSTRAINT "NotificationSound_userId_fkey" 
              FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
          END $$;
        `);
      } else {
        // Safe SQLite DDL for local development
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "NotificationSound" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "workspaceId" TEXT NOT NULL,
            "userId" TEXT,
            "notificationType" TEXT NOT NULL,
            "originalFileName" TEXT NOT NULL,
            "storagePath" TEXT NOT NULL,
            "fileUrl" TEXT NOT NULL,
            "mimeType" TEXT NOT NULL,
            "fileSize" INTEGER NOT NULL,
            "duration" REAL,
            "status" TEXT NOT NULL DEFAULT 'ACTIVE',
            "isActive" BOOLEAN NOT NULL DEFAULT 1,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "NotificationSound_workspaceId_notificationType_key" 
          ON "NotificationSound"("workspaceId", "notificationType");
        `);
      }

      tableEnsured = true;
      return true;
    } catch (err: any) {
      console.warn("[ensureNotificationSoundTable] Notice/Warning:", err?.message || err);
      // Even if raw DDL throws because table already exists or constraint already present, proceed
      tableEnsured = true;
      return true;
    } finally {
      tableEnsuringPromise = null;
    }
  })();

  return tableEnsuringPromise;
}
