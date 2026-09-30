import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserWorkspaceId } from "@/lib/workspace";
import { deleteAudioFile } from "@/lib/notifications/sound-storage";
import { ensureNotificationSoundTable } from "@/lib/db/ensure-tables";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });
  }

  const { id } = await params;

  await ensureNotificationSoundTable();

  const sound = await prisma.notificationSound.findFirst({
    where: { id, workspaceId },
  });

  if (!sound) {
    return NextResponse.json({ error: "Som não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ sound });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { isActive, status } = body;

    const existing = await prisma.notificationSound.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Som não encontrado" }, { status: 404 });
    }

    const updated = await prisma.notificationSound.update({
      where: { id },
      data: {
        ...(typeof isActive === "boolean" ? { isActive } : {}),
        ...(typeof status === "string" ? { status } : {}),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, sound: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar som" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.notificationSound.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Som não encontrado" }, { status: 404 });
    }

    // Deletar arquivo físico
    if (existing.storagePath) {
      await deleteAudioFile(existing.storagePath);
    }

    // Deletar registro do banco
    await prisma.notificationSound.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Som personalizado removido. O som padrão UTM-Track será utilizado.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao remover som" },
      { status: 500 }
    );
  }
}
