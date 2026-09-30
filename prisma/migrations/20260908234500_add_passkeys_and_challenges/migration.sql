-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."WebAuthnChallenge" (
    "id" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasskeyCredential_credentialId_key" ON "public"."PasskeyCredential"("credentialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasskeyCredential_userId_idx" ON "public"."PasskeyCredential"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_challenge_idx" ON "public"."WebAuthnChallenge"("challenge");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_expiresAt_idx" ON "public"."WebAuthnChallenge"("expiresAt");

-- AddForeignKey
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
