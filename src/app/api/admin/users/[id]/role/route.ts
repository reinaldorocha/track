import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireAdminApi, logAudit } from "@/lib/access-control";

const roleSchema = z.object({
  role: z.enum(["ADMIN", "CLIENT", "SUPER_ADMIN"]),
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
        { error: "Não é permitido alterar o papel da sua própria conta administrativa" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = roleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Role inválida", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { role } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
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
      action: "ROLE_CHANGE",
      resource: "user",
      resourceId: userId,
      userId: adminUser.id,
      userEmail: adminUser.email || undefined,
      metadata: {
        targetUserId: userId,
        targetEmail: user.email,
        oldRole: user.role,
        newRole: role,
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: `Papel do usuário alterado para ${role}`,
      user: updated,
    });
  } catch (err: any) {
    console.error("[Admin User Role API] Error:", err);
    return NextResponse.json({ error: "Erro ao atualizar papel do usuário" }, { status: 500 });
  }
}
