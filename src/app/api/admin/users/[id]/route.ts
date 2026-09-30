import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, logAudit } from "@/lib/access-control";

export async function DELETE(
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
        { error: "Não é permitido excluir sua própria conta de administrador" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // 1. Remover sessões e dispositivos do usuário
    await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.device.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.notificationPreference.deleteMany({ where: { userId } }).catch(() => {});

    // 2. Remover associações de WorkspaceMember
    await prisma.workspaceMember.deleteMany({ where: { userId } }).catch(() => {});

    // 3. Remover usuário
    await prisma.user.delete({
      where: { id: userId },
    });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    await logAudit({
      action: "DELETE_USER",
      resource: "user",
      resourceId: userId,
      userId: adminUser.id,
      userEmail: adminUser.email || undefined,
      metadata: {
        deletedUserId: userId,
        deletedUserEmail: user.email,
        deletedUserName: user.name,
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: "Usuário excluído com sucesso do sistema",
    });
  } catch (err: any) {
    console.error("[Admin Delete User API] Error:", err);
    return NextResponse.json({ error: "Erro ao excluir usuário" }, { status: 500 });
  }
}
