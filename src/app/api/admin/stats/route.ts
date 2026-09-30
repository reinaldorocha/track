import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/access-control";

export async function GET() {
  const authRes = await requireAdminApi();
  if (authRes instanceof NextResponse) return authRes;

  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalWorkspaces,
      recentAuditLogs,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: { in: ["SUSPENDED", "DISABLED"] } } }),
      prisma.workspace.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalWorkspaces,
      },
      recentAuditLogs,
      recentUsers,
    });
  } catch (err: any) {
    console.error("[Admin Stats API] Error:", err);
    return NextResponse.json({ error: "Erro ao buscar métricas administrativas" }, { status: 500 });
  }
}
