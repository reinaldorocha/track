import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export type UserRole = "ADMIN" | "CLIENT" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "INVITED" | "DISABLED";

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  status?: string | null;
  image?: string | null;
}

/**
 * Verifica se a sessão ou usuário pertence a um Administrador do sistema
 */
export function isAdmin(sessionOrUser?: { user?: SessionUser } | SessionUser | null): boolean {
  if (!sessionOrUser) return false;
  const user: SessionUser | undefined = 'user' in sessionOrUser && sessionOrUser.user 
    ? sessionOrUser.user 
    : (sessionOrUser as SessionUser);

  if (!user || (!user.id && !user.email && !user.role)) return false;
  const role = String(user.role || "").toUpperCase();
  const email = String(user.email || "").toLowerCase();
  const adminEmail = String(process.env.ADMIN_EMAIL || "").toLowerCase();
  const initialAdminEmail = String(process.env.INITIAL_ADMIN_EMAIL || "").toLowerCase();

  return (
    role === "ADMIN" || 
    role === "SUPER_ADMIN" || 
    (Boolean(adminEmail) && email === adminEmail) ||
    (Boolean(initialAdminEmail) && email === initialAdminEmail)
  );
}

/**
 * Valida autorização de Administrador em rotas de API.
 * Retorna a sessão válida do Admin ou NextResponse com status 401/403.
 */
export async function requireAdminApi(explicitSession?: { user?: SessionUser } | null): Promise<{ session: { user: SessionUser } } | NextResponse> {
  const session = explicitSession !== undefined ? explicitSession : await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Acesso não autenticado." }, 
      { status: 401 }
    );
  }

  if (!isAdmin(session as any)) {
    return NextResponse.json(
      { error: "Forbidden", message: "Acesso restrito a administradores do sistema." },
      { status: 403 }
    );
  }

  return { session: session as any };
}

export interface AuthSession {
  user?: SessionUser | null;
}

/**
 * Valida autorização de Usuário em rotas de API protegidas.
 * Rejeita usuários com status SUSPENDED ou DISABLED.
 */
export async function requireUserApi(explicitSession?: { user?: SessionUser } | null): Promise<{ session: { user: SessionUser } } | NextResponse> {
  const session = explicitSession !== undefined ? explicitSession : await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Acesso não autenticado." }, 
      { status: 401 }
    );
  }

  const status = String((session.user as any).status || "ACTIVE").toUpperCase();
  if (status === "SUSPENDED" || status === "DISABLED") {
    return NextResponse.json(
      { error: "Forbidden", message: "Acesso temporariamente bloqueado. Contate o administrador." },
      { status: 403 }
    );
  }

  return { session: session as any };
}

/**
 * Registra um evento de auditoria de segurança no banco de dados.
 * Protegido contra vazamento de senhas ou chaves sensíveis.
 */
export async function logAudit(params: {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  userEmail?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    const safeMetadata = params.metadata ? { ...params.metadata } : {};
    delete (safeMetadata as any).password;
    delete (safeMetadata as any).newPassword;
    delete (safeMetadata as any).accessToken;
    delete (safeMetadata as any).secret;
    delete (safeMetadata as any).serviceRole;

    await prisma.auditLog.create({
      data: {
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        userId: params.userId,
        userEmail: params.userEmail,
        workspaceId: params.workspaceId,
        metadata: JSON.stringify(safeMetadata),
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Erro ao gravar log de auditoria:", err);
  }
}
