import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserWorkspaceId } from "@/lib/workspace";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();

  const expense = await prisma.expense.update({
    where: { id, workspaceId },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.category && { category: body.category }),
      ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
      ...(body.date && { date: new Date(body.date) }),
      ...(body.recurrence && { recurrence: body.recurrence }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  });

  return NextResponse.json(expense);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getUserWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 404 });
  }

  const { id } = await params;
  await prisma.expense.delete({ where: { id, workspaceId } });
  return NextResponse.json({ success: true });
}
