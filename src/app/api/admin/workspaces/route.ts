import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/access-control";

export async function GET(req: Request) {
  const authRes = await requireAdminApi();
  if (authRes instanceof NextResponse) return authRes;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim();

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const workspaces = await prisma.workspace.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            adAccounts: true,
            integrations: true,
            sales: true,
            trackingEvents: true,
          },
        },
      },
    });

    return NextResponse.json({
      workspaces: workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        timezone: ws.timezone,
        currency: ws.currency,
        createdAt: ws.createdAt,
        membersCount: ws.members.length,
        members: ws.members.map((m) => ({
          role: m.role,
          user: m.user,
        })),
        counts: ws._count,
      })),
      total: workspaces.length,
    });
  } catch (err: any) {
    console.error("[Admin Workspaces API] Error:", err);
    return NextResponse.json({ error: "Erro ao buscar workspaces" }, { status: 500 });
  }
}
