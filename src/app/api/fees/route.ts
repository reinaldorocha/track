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

  const fees = await prisma.fee.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ fees });
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
  const { name, type, paymentMethod, percentage, fixedAmount, installmentFee, platform, isActive } = body;

  if (!name) {
    return NextResponse.json({ error: "O nome da taxa é obrigatório" }, { status: 400 });
  }

  const fee = await prisma.fee.create({
    data: {
      workspaceId,
      name,
      type: type || "checkout",
      paymentMethod: paymentMethod || null,
      percentage: parseFloat(percentage) || 0,
      fixedAmount: parseFloat(fixedAmount) || 0,
      installmentFee: parseFloat(installmentFee) || 0,
      platform: platform || null,
      isActive: isActive !== false,
    },
  });

  return NextResponse.json(fee, { status: 201 });
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
  const { id, name, type, paymentMethod, percentage, fixedAmount, installmentFee, platform, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: "ID da taxa é obrigatório" }, { status: 400 });
  }

  const existing = await prisma.fee.findFirst({
    where: { id, workspaceId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Taxa não encontrada" }, { status: 404 });
  }

  const updated = await prisma.fee.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      type: type ?? existing.type,
      paymentMethod: paymentMethod !== undefined ? paymentMethod : existing.paymentMethod,
      percentage: percentage !== undefined ? parseFloat(percentage) || 0 : existing.percentage,
      fixedAmount: fixedAmount !== undefined ? parseFloat(fixedAmount) || 0 : existing.fixedAmount,
      installmentFee: installmentFee !== undefined ? parseFloat(installmentFee) || 0 : existing.installmentFee,
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
    return NextResponse.json({ error: "ID da taxa é obrigatório" }, { status: 400 });
  }

  const existing = await prisma.fee.findFirst({
    where: { id, workspaceId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Taxa não encontrada" }, { status: 404 });
  }

  await prisma.fee.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
