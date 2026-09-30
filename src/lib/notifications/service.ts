import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { dispatchPushToDevices } from "./push-dispatcher";

export type SaleNotificationType =
  | "sale_approved"
  | "pix_pending"
  | "sale_pending"
  | "refund"
  | "chargeback";

export interface CreateSaleNotificationParams {
  workspaceId: string;
  userId?: string;
  type: SaleNotificationType;
  saleId?: string;
  orderId?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  platform?: string;
  product?: string;
}

export async function createSaleNotification(params: CreateSaleNotificationParams) {
  const {
    workspaceId,
    userId,
    type,
    saleId,
    orderId,
    transactionId,
    amount,
    currency = "BRL",
    platform,
    product,
  } = params;

  // 1. Idempotência estrita: um evento específico de venda não gera notificação duplicada
  const eventIdentifier = transactionId || saleId || orderId || Date.now().toString();
  const idempotencyKey = `notif_${workspaceId}_${type}_${eventIdentifier}`;
  
  const existing = await prisma.notification.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return { notification: existing, dispatched: false, reason: "idempotent_duplicate" };
  }

  // 2. Construção dos textos conforme especificação oficial do UTM-Track
  let title = "Notificação de Venda";
  let message = "";
  let sound = "som_venda_aprovada";
  let severity = "info";

  const formattedAmount = amount !== undefined && amount !== null ? formatCurrency(amount, currency) : "R$ 0,00";

  switch (type) {
    case "sale_approved":
      title = "Venda aprovada!";
      message = `Venda aprovada no valor de ${formattedAmount}`;
      sound = "som_venda_aprovada";
      severity = "success";
      break;

    case "pix_pending":
      title = "Pix gerado!";
      message = `Um Pix de ${formattedAmount} foi gerado e está aguardando pagamento.`;
      sound = "som_pix_gerado";
      severity = "info";
      break;

    case "sale_pending":
      title = "Venda pendente!";
      message = `Venda de ${formattedAmount} aguardando confirmação.`;
      sound = "som_venda_pendente";
      severity = "info";
      break;

    case "refund":
      title = "Venda reembolsada";
      message = `Uma venda de ${formattedAmount} foi reembolsada.`;
      sound = "som_reembolso";
      severity = "warning";
      break;

    case "chargeback":
      title = "Chargeback recebido";
      message = `Foi registrado um chargeback de ${formattedAmount}.`;
      sound = "som_chargeback";
      severity = "error";
      break;
  }

  // 3. Checagem das preferências e sons personalizados do workspace/usuário
  let shouldSendPush = true;
  let useCustomSounds = false;

  const pref = userId
    ? await prisma.notificationPreference.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      })
    : await prisma.notificationPreference.findFirst({
        where: { workspaceId },
      });

  if (pref) {
    if (type === "sale_approved" && !pref.salesApproved) shouldSendPush = false;
    if (type === "pix_pending" && !pref.pixGenerated) shouldSendPush = false;
    if (type === "sale_pending" && !pref.salesPending) shouldSendPush = false;
    if (type === "refund" && !pref.refunds) shouldSendPush = false;
    if (type === "chargeback" && !pref.chargebacks) shouldSendPush = false;
    useCustomSounds = !!pref.useCustomSounds;
  }

  // 4. Verificação de som personalizado configurado
  let customSoundRecord = null;
  let customSoundUrl: string | null = null;
  let customSoundName: string | null = null;

  if (useCustomSounds) {
    customSoundRecord = await prisma.notificationSound.findFirst({
      where: {
        workspaceId,
        notificationType: type,
        isActive: true,
      },
    });

    if (customSoundRecord) {
      customSoundUrl = customSoundRecord.fileUrl;
      customSoundName = customSoundRecord.originalFileName;
    }
  }

  // 5. Criação do registro no banco
  const deepLink = saleId ? `/sales/${saleId}` : `/notifications`;

  const notification = await prisma.notification.create({
    data: {
      workspaceId,
      userId,
      type,
      title,
      message,
      severity,
      amount,
      currency,
      platform,
      product,
      saleId,
      orderId,
      transactionId,
      sound: customSoundName || sound,
      pushStatus: shouldSendPush ? "sent" : "skipped",
      idempotencyKey,
      metadata: JSON.stringify({
        source: "sales_engine",
        soundFile: customSoundUrl || `/sounds/${sound}.wav`,
        isCustomSound: !!customSoundRecord,
        customSoundId: customSoundRecord?.id,
        customSoundName: customSoundRecord?.originalFileName,
        customSoundUrl: customSoundUrl,
        deepLink,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  // 6. Despacho real para dispositivos móveis registrados (Android e iOS)
  let pushResult = {
    totalTargeted: 0,
    successCount: 0,
    failureCount: 0,
    prunedTokensCount: 0,
    errors: [] as string[],
  };

  if (shouldSendPush) {
    pushResult = await dispatchPushToDevices({
      notificationId: notification.id,
      workspaceId,
      type,
      title,
      body: message,
      sound,
      customSoundUrl: customSoundUrl || undefined,
      customSoundName: customSoundName || undefined,
      saleId,
      orderId,
      amount,
      currency,
      platform,
    });
  }

  return {
    notification,
    dispatched: shouldSendPush,
    devicesTargeted: pushResult.totalTargeted,
    sound: customSoundName || sound,
    isCustomSound: !!customSoundRecord,
    pushResult,
  };
}

export async function getOrCreatePreferences(workspaceId: string, userId: string) {
  let pref = await prisma.notificationPreference.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!pref) {
    pref = await prisma.notificationPreference.create({
      data: {
        workspaceId,
        userId,
        salesApproved: true,
        salesPending: true,
        pixGenerated: true,
        refunds: true,
        chargebacks: true,
        systemAlerts: true,
        integrationErrors: true,
        soundEnabled: true,
        vibrationEnabled: true,
      },
    });
  }

  return pref;
}

export async function registerDeviceToken(params: {
  workspaceId: string;
  userId?: string;
  token: string;
  platform: "android" | "ios" | "web";
  deviceName?: string;
}) {
  const { workspaceId, userId, token, platform, deviceName } = params;

  return await prisma.device.upsert({
    where: { token },
    create: {
      workspaceId,
      userId,
      token,
      platform,
      deviceName,
      isActive: true,
      lastSeenAt: new Date(),
    },
    update: {
      workspaceId,
      userId,
      platform,
      deviceName,
      isActive: true,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    },
  });
}
