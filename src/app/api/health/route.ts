import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = {
    ok: true,
    service: "utm-track",
    timestamp: new Date().toISOString(),
    status: "healthy",
  };

  // Lightweight DB connectivity probe so production issues can be diagnosed
  // straight from the browser at /api/health.
  let database: { connected: boolean; error?: string } = { connected: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { connected: true };
  } catch (error) {
    database = {
      connected: false,
      error: (error as { code?: string })?.code || (error as Error)?.message || "unknown",
    };
  }

  return NextResponse.json(
    { ...base, ok: database.connected, database },
    { status: database.connected ? 200 : 503 }
  );
}
