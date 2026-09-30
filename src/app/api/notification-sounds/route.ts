import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserWorkspaceId } from "@/lib/workspace";
import {
  validateAudioUpload,
  saveAudioFile,
  deleteAudioFile,
  RECOMMENDED_DURATION_SECONDS,
} from "@/lib/notifications/sound-storage";
import { ensureNotificationSoundTable } from "@/lib/db/ensure-tables";

export const VALID_NOTIFICATION_TYPES = [
  "sale_approved",
  "pix_pending",
  "sale_pending",
  "refund",
  "chargeback",
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });
  }

  try {
    await ensureNotificationSoundTable();

    const sounds = await prisma.notificationSound.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ sounds });
  } catch (error: any) {
    console.error("[Notification Sounds API GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao listar sons de notificação" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });
  }

  try {
    await ensureNotificationSoundTable();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const notificationType = (formData.get("notificationType") as string || "").trim();
    const durationRaw = formData.get("duration") as string | null;
    const duration = durationRaw ? parseFloat(durationRaw) : undefined;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo de áudio foi enviado." },
        { status: 400 }
      );
    }

    if (!notificationType || !VALID_NOTIFICATION_TYPES.includes(notificationType)) {
      return NextResponse.json(
        {
          error: `Tipo de notificação inválido. Permitidos: ${VALID_NOTIFICATION_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validação estrita de formato, tamanho, MIME e Magic Bytes
    const validation = validateAudioUpload(buffer, file.name, file.type, duration);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Verificar se já existe som anterior para este tipo no workspace para substituir com limpeza
    const existing = await prisma.notificationSound.findUnique({
      where: {
        workspaceId_notificationType: {
          workspaceId,
          notificationType,
        },
      },
    });

    if (existing?.storagePath) {
      await deleteAudioFile(existing.storagePath);
    }

    // Salvar arquivo no diretório isolado do workspace
    const { storagePath, fileName } = await saveAudioFile(
      workspaceId,
      notificationType,
      buffer,
      file.name
    );

    // Persistir registro no banco
    const soundRecord = await prisma.notificationSound.upsert({
      where: {
        workspaceId_notificationType: {
          workspaceId,
          notificationType,
        },
      },
      create: {
        workspaceId,
        userId: session.user.id,
        notificationType,
        originalFileName: validation.sanitizedOriginalName || file.name,
        storagePath,
        fileUrl: `/api/notification-sounds/placeholder/file`, // Será atualizado com o ID
        mimeType: file.type || "audio/mpeg",
        fileSize: buffer.length,
        duration: duration || null,
        status: "ACTIVE",
        isActive: true,
      },
      update: {
        userId: session.user.id,
        originalFileName: validation.sanitizedOriginalName || file.name,
        storagePath,
        mimeType: file.type || "audio/mpeg",
        fileSize: buffer.length,
        duration: duration || null,
        status: "ACTIVE",
        isActive: true,
        updatedAt: new Date(),
      },
    });

    // Atualizar URL definitiva com o ID gerado
    const updated = await prisma.notificationSound.update({
      where: { id: soundRecord.id },
      data: {
        fileUrl: `/api/notification-sounds/${soundRecord.id}/file`,
      },
    });

    const isLongDuration = duration && duration > RECOMMENDED_DURATION_SECONDS;

    return NextResponse.json(
      {
        success: true,
        message: "Som personalizado configurado com sucesso!",
        sound: updated,
        warning: isLongDuration
          ? `O áudio tem ${duration.toFixed(1)}s. Recomendamos arquivos curtos de até 10s para notificações.`
          : undefined,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Notification Sounds API POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno ao processar upload do som." },
      { status: 500 }
    );
  }
}
