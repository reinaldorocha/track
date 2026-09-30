import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registerDeviceToken } from "@/lib/notifications/service";

export async function GET() {
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

  const devices = await prisma.device.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { lastSeenAt: "desc" },
  });

  return NextResponse.json({ devices });
}

export async function POST(req: Request) {
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
    const { token, platform, deviceName } = body;

    if (!token || !platform) {
      return NextResponse.json({ error: "Missing token or platform" }, { status: 400 });
    }

    const device = await registerDeviceToken({
      workspaceId: membership.workspaceId,
      userId: session.user.id,
      token,
      platform,
      deviceName,
    });

    return NextResponse.json({ success: true, device });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    await prisma.device.updateMany({
      where: { token },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
