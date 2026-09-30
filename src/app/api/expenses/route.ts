import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getWorkspaceId(userId: string): Promise<string | null> {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return member?.workspaceId || null;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where: { workspaceId },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.expense.count({ where: { workspaceId } }),
  ]);

  return NextResponse.json({ expenses, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(session.user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 404 });
  }

  const body = await request.json();
  const { name, category, amount, date, recurrence, notes } = body;

  if (!name || !category || amount === undefined || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      workspaceId,
      name,
      category,
      amount: parseFloat(amount),
      date: new Date(date),
      recurrence: recurrence || "one_time",
      notes: notes || null,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
