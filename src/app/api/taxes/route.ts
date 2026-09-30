import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserWorkspaceId } from "@/lib/workspace";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 404 });
  }

  const taxes = await prisma.tax.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ taxes });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 404 });
  }

  const body = await request.json();
  const { name, type, percentage, platform, isActive } = body;

  if (!name) {
    return NextResponse.json({ error: "O nome do imposto é obrigatório" }, { status: 400 });
  }

  const tax = await prisma.tax.create({
    data: {
      workspaceId,
      name,
      type: type || "sales",
      percentage: parseFloat(percentage) || 0,
      platform: platform || null,
      isActive: isActive !== false,
    },
  });

  return NextResponse.json(tax, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 404 });
  }

  const body = await request.json();
  const { id, name, type, percentage, platform, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: "ID do imposto é obrigatório" }, { status: 400 });
  }

  const existing = await prisma.tax.findFirst({
    where: { id, workspaceId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Imposto não encontrado" }, { status: 404 });
  }

  const updated = await prisma.tax.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      type: type ?? existing.type,
      percentage: percentage !== undefined ? parseFloat(percentage) || 0 : existing.percentage,
      platform: platform !== undefined ? (platform || null) : existing.platform,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID do imposto é obrigatório" }, { status: 400 });
  }

  const existing = await prisma.tax.findFirst({
    where: { id, workspaceId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Imposto não encontrado" }, { status: 404 });
  }

  await prisma.tax.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
