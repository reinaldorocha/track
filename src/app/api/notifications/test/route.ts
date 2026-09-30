import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserWorkspaceId } from "@/lib/workspace";
import { dispatchPushToDevices } from "@/lib/notifications/push-dispatcher";

// Rate limiting in memory: max 10 requests per minute per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (userLimit.count >= 10) {
    return false;
  }

  userLimit.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento antes de enviar outro teste de notificação." },
        { status: 429 }
      );
    }

    const workspaceId = await getUserWorkspaceId(session.user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const testType = body.type || "general";
    
    let defaultTitle = "🔔 UTM-Track";
    let defaultMessage = "Notificação de teste recebida com sucesso. Seu aplicativo está configurado corretamente para receber notificações push.";
    let defaultSound = "som_venda_aprovada";

    if (testType === "sale_approved") {
      defaultTitle = "💰 Venda aprovada!";
      defaultMessage = "Venda de R$ 151,04 aprovada na Hotmart.";
      defaultSound = "som_venda_aprovada";
    } else if (testType === "pix_pending") {
      defaultTitle = "⚡ Pix gerado";
      defaultMessage = "Um Pix de R$ 151,04 está aguardando pagamento.";
      defaultSound = "som_pix_gerado";
    } else if (testType === "sale_pending") {
      defaultTitle = "⏳ Venda pendente";
      defaultMessage = "Boleto de R$ 151,04 impresso e aguardando pagamento.";
      defaultSound = "som_venda_pendente";
    } else if (testType === "refund") {
      defaultTitle = "⚠️ Venda reembolsada";
      defaultMessage = "Uma venda de R$ 151,04 foi reembolsada.";
      defaultSound = "som_reembolso";
    } else if (testType === "chargeback") {
      defaultTitle = "🚨 Chargeback recebido";
      defaultMessage = "Foi registrado um chargeback de R$ 151,04.";
      defaultSound = "som_chargeback";
    }

    const customTitle = body.title || defaultTitle;
    const customMessage = body.message || defaultMessage;
    let sound = body.sound || defaultSound;
    let customSoundUrl = body.customSoundUrl || null;
    let customSoundName = body.customSoundName || null;
    let isCustomSound = false;

    // Verificar se há som personalizado ativo para este tipo
    if (testType !== "general") {
      const customSoundRecord = await prisma.notificationSound.findFirst({
        where: {
          workspaceId,
          notificationType: testType,
          isActive: true,
        },
      });

      if (customSoundRecord) {
        customSoundUrl = customSoundRecord.fileUrl;
        customSoundName = customSoundRecord.originalFileName;
        sound = customSoundRecord.originalFileName;
        isCustomSound = true;
      }
    }

    // 1. Buscar dispositivos ativos registrados para este workspace / usuário
    const devices = await prisma.device.findMany({
      where: {
        OR: [
          { workspaceId, isActive: true },
          { userId: session.user.id, isActive: true },
        ],
      },
      orderBy: { lastSeenAt: "desc" },
    });

    // 2. Registrar evento de notificação de teste no banco (SEM gerar venda ou efeito financeiro)
    const notification = await prisma.notification.create({
      data: {
        workspaceId,
        userId: session.user.id,
        type: "push_test",
        title: customTitle,
        message: customMessage,
        severity: "info",
        sound,
        pushStatus: devices.length > 0 ? "sent" : "skipped",
        idempotencyKey: `push_test_${session.user.id}_${Date.now()}`,
        metadata: JSON.stringify({
          source: "push_test_engine",
          soundFile: customSoundUrl || `/sounds/${sound}.wav`,
          isCustomSound,
          customSoundName,
          customSoundUrl,
          deepLink: "/notifications",
          devicesTargeted: devices.length,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    if (devices.length === 0) {
      return NextResponse.json({
        success: false,
        warning: "Nenhum dispositivo móvel registrado",
        message:
          "Nenhum dispositivo Android/iOS conectado para este usuário. Abra o aplicativo UTM-Track no celular para registrar o dispositivo automaticamente.",
        devicesCount: 0,
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          sound,
          customSoundUrl,
          isCustomSound,
          createdAt: notification.createdAt,
        },
      });
    }

    // 3. Despachar push real para os dispositivos
    const pushResult = await dispatchPushToDevices({
      notificationId: notification.id,
      workspaceId,
      type: "push_test",
      title: customTitle,
      body: customMessage,
      sound: defaultSound, // Som base / canal
      customSoundUrl: customSoundUrl || undefined,
      customSoundName: customSoundName || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Notificação de teste enviada com sucesso para o seu dispositivo.",
      devicesCount: devices.length,
      pushResult: {
        totalTargeted: pushResult.totalTargeted,
        successCount: pushResult.successCount,
        failureCount: pushResult.failureCount,
        prunedTokensCount: pushResult.prunedTokensCount,
        errors: pushResult.errors,
      },
      notification: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        sound,
        createdAt: notification.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[Push Test API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao processar teste de push" },
      { status: 500 }
    );
  }
}
