import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdminApi, logAudit } from "@/lib/access-control";

const createUserSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  workspaceName: z.string().optional(),
  role: z.enum(["ADMIN", "CLIENT"]).default("CLIENT"),
  status: z.enum(["ACTIVE", "SUSPENDED", "INVITED", "DISABLED"]).default("ACTIVE"),
});

export async function GET(req: Request) {
  const authRes = await requireAdminApi();
  if (authRes instanceof NextResponse) return authRes;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const status = searchParams.get("status");
    const role = searchParams.get("role");

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (role && role !== "ALL") {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        mustChangePassword: true,
        memberships: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ users, total: users.length });
  } catch (err: any) {
    console.error("[Admin Users GET API] Error:", err);
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authRes = await requireAdminApi();
  if (authRes instanceof NextResponse) return authRes;
  const adminUser = authRes.session.user;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password, workspaceName, role, status } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verificar se usuário já existe
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "E-mail já cadastrado no sistema" },
        { status: 409 }
      );
    }

    // 2. Hash seguro da senha com bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Criar o Usuário com a Role e Status definidos pelo Admin
    const newUser = await prisma.user.create({
      data: {
        name,
        email: cleanEmail,
        password: hashedPassword,
        role,
        status,
        createdBy: adminUser.id,
        mustChangePassword: true,
      },
    });

    // 4. Criar Workspace dedicado para o novo Cliente
    const wsName = workspaceName || `${name.split(" ")[0]} Workspace`;
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ws";
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

    const workspace = await prisma.workspace.create({
      data: {
        name: wsName,
        slug,
        members: {
          create: {
            userId: newUser.id,
            role: "owner",
          },
        },
      },
    });

    // 5. Criar preferências padrão de notificação para o usuário
    await prisma.notificationPreference.create({
      data: {
        workspaceId: workspace.id,
        userId: newUser.id,
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
    }).catch(() => {});

    // 6. Gravar log de auditoria
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    await logAudit({
      action: "CREATE_USER",
      resource: "user",
      resourceId: newUser.id,
      userId: adminUser.id,
      userEmail: adminUser.email || undefined,
      workspaceId: workspace.id,
      metadata: {
        createdUserId: newUser.id,
        createdUserEmail: newUser.email,
        createdUserName: newUser.name,
        role,
        status,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: "Usuário criado com sucesso",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        },
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error("[Admin Users POST API] Error:", err);
    return NextResponse.json({ error: "Erro interno ao criar usuário" }, { status: 500 });
  }
}
