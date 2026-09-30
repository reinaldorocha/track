import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreatePreferences } from "@/lib/notifications/service";
import { ensureNotificationSoundTable } from "@/lib/db/ensure-tables";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureNotificationSoundTable();

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const preferences = await getOrCreatePreferences(membership.workspaceId, session.user.id);
  return NextResponse.json({ preferences });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const {
      salesApproved,
      salesPending,
      pixGenerated,
      refunds,
      chargebacks,
      systemAlerts,
      integrationErrors,
      soundEnabled,
      vibrationEnabled,
      useCustomSounds,
    } = body;

    const updated = await prisma.notificationPreference.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: membership.workspaceId,
          userId: session.user.id,
        },
      },
      create: {
        workspaceId: membership.workspaceId,
        userId: session.user.id,
        salesApproved: salesApproved ?? true,
        salesPending: salesPending ?? true,
        pixGenerated: pixGenerated ?? true,
        refunds: refunds ?? true,
        chargebacks: chargebacks ?? true,
        systemAlerts: systemAlerts ?? true,
        integrationErrors: integrationErrors ?? true,
        soundEnabled: soundEnabled ?? true,
        vibrationEnabled: vibrationEnabled ?? true,
        useCustomSounds: useCustomSounds ?? false,
      },
      update: {
        salesApproved,
        salesPending,
        pixGenerated,
        refunds,
        chargebacks,
        systemAlerts,
        integrationErrors,
        soundEnabled,
        vibrationEnabled,
        useCustomSounds,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, preferences: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
