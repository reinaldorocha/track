import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireAdminApi, logAudit } from "@/lib/access-control";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "INVITED", "DISABLED"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authRes = await requireAdminApi();
  if (authRes instanceof NextResponse) return authRes;
  const adminUser = authRes.session.user;

  try {
    const resolvedParams = await Promise.resolve(params);
    const userId = resolvedParams.id;

    if (!userId) {
      return NextResponse.json({ error: "ID de usuário obrigatório" }, { status: 400 });
    }

    if (userId === adminUser.id) {
      return NextResponse.json(
        { error: "Não é permitido alterar o status da sua própria conta de administrador" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Status inválido", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { status } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    await logAudit({
      action: status === "ACTIVE" ? "ACTIVATE_USER" : status === "SUSPENDED" ? "SUSPEND_USER" : "UPDATE_USER_STATUS",
      resource: "user",
      resourceId: userId,
      userId: adminUser.id,
      userEmail: adminUser.email || undefined,
      metadata: {
        targetUserId: userId,
        targetEmail: user.email,
        oldStatus: user.status,
        newStatus: status,
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: `Status do usuário atualizado para ${status}`,
      user: updated,
    });
  } catch (err: any) {
    console.error("[Admin User Status API] Error:", err);
    return NextResponse.json({ error: "Erro ao atualizar status do usuário" }, { status: 500 });
  }
}
