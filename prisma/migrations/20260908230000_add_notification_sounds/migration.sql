-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "useCustomSounds" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationSound" (
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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationSound_workspaceId_notificationType_key" ON "NotificationSound"("workspaceId", "notificationType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationSound_workspaceId_isActive_idx" ON "NotificationSound"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationSound_workspaceId_notificationType_idx" ON "NotificationSound"("workspaceId", "notificationType");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSound_workspaceId_fkey'
    ) THEN
        ALTER TABLE "NotificationSound" ADD CONSTRAINT "NotificationSound_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSound_userId_fkey'
    ) THEN
        ALTER TABLE "NotificationSound" ADD CONSTRAINT "NotificationSound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
