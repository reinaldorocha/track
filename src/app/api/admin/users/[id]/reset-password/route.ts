import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdminApi, logAudit } from "@/lib/access-control";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
});

export async function POST(
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

    const body = await req.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Senha inválida", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
      },
    });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    await logAudit({
      action: "RESET_PASSWORD",
      resource: "user",
      resourceId: userId,
      userId: adminUser.id,
      userEmail: adminUser.email || undefined,
      metadata: {
        targetUserId: userId,
        targetEmail: user.email,
        mustChangePassword: true,
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: "Senha redefinida com sucesso. O usuário precisará alterar no próximo acesso.",
    });
  } catch (err: any) {
    console.error("[Admin Reset Password API] Error:", err);
    return NextResponse.json({ error: "Erro ao redefinir senha do usuário" }, { status: 500 });
  }
}
