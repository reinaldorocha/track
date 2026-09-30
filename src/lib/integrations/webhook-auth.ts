import { prisma } from '@/lib/db'

export interface WebhookAuthResult {
  authorized: boolean
  workspaceId?: string
  integrationId?: string
  error?: string
  status: 200 | 401 | 404
}

export interface WebhookAuthParams {
  platform: string
  providedToken: string | null
  queryWorkspaceId?: string | null
  globalEnvSecret?: string | null
}

/**
 * Validação rigorosa de autenticação para Webhooks de pagamento.
 * Rejeita SEMPRE chamadas sem token ou com token inválido.
 * Assegura que o workspaceId está autenticado pelo segredo correto da integração.
 */
export async function authenticateWebhook(params: WebhookAuthParams): Promise<WebhookAuthResult> {
  const { platform, providedToken, queryWorkspaceId, globalEnvSecret } = params

  // 1. Token é estritamente obrigatório em produção
  const token = providedToken ? providedToken.trim() : null
  if (!token) {
    return {
      authorized: false,
      status: 401,
      error: `Unauthorized: Missing webhook authentication token for ${platform}`
    }
  }

  // 2. Se workspaceId foi passado na query/header, validar integração desse workspace
  if (queryWorkspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: queryWorkspaceId }
    })
    if (!workspace) {
      return {
        authorized: false,
        status: 404,
        error: `Workspace not found: ${queryWorkspaceId}`
      }
    }

    // Buscar integração do workspace
    const integration = await prisma.integration.findFirst({
      where: {
        workspaceId: workspace.id,
        platform: { in: [platform, platform.toLowerCase()] }
      }
    })

    // Se a integração possui webhookSecret configurado
    if (integration?.webhookSecret) {
      if (token === integration.webhookSecret || (globalEnvSecret && token === globalEnvSecret)) {
        return {
          authorized: true,
          status: 200,
          workspaceId: workspace.id,
          integrationId: integration.id
        }
      }
      return {
        authorized: false,
        status: 401,
        error: 'Unauthorized: Invalid webhook secret for this workspace'
      }
    }

    // Se a integração não tem segredo próprio mas existe segredo global em ENV
    if (globalEnvSecret) {
      if (token === globalEnvSecret) {
        return {
          authorized: true,
          status: 200,
          workspaceId: workspace.id,
          integrationId: integration?.id
        }
      }
      return {
        authorized: false,
        status: 401,
        error: 'Unauthorized: Webhook token does not match environment secret'
      }
    }

    // Se nenhum segredo foi configurado para esse workspace nem no ENV
    return {
      authorized: false,
      status: 401,
      error: `Unauthorized: No webhook secret configured for workspace ${workspace.id}`
    }
  }

  // 3. Se workspaceId NÃO foi passado, autenticar pelo segredo da integração diretamente
  // 3.1 Verificar se o token pertence ao webhookSecret de alguma integração cadastrada
  const integrationBySecret = await prisma.integration.findFirst({
    where: {
      platform: { in: [platform, platform.toLowerCase()] },
      webhookSecret: token
    }
  })

  if (integrationBySecret) {
    return {
      authorized: true,
      status: 200,
      workspaceId: integrationBySecret.workspaceId,
      integrationId: integrationBySecret.id
    }
  }

  // 3.2 Se o token bate com o segredo global em ENV
  if (globalEnvSecret && token === globalEnvSecret) {
    // Buscar integração ativa dessa plataforma
    const activeIntegration = await prisma.integration.findFirst({
      where: {
        platform: { in: [platform, platform.toLowerCase()] }
      }
    })

    if (activeIntegration) {
      return {
        authorized: true,
        status: 200,
        workspaceId: activeIntegration.workspaceId,
        integrationId: activeIntegration.id
      }
    }

    // Fallback para o workspace padrão
    const defaultWs = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
    if (defaultWs) {
      return {
        authorized: true,
        status: 200,
        workspaceId: defaultWs.id
      }
    }
  }

  // 4. Token não encontrado nem no banco nem no env
  return {
    authorized: false,
    status: 401,
    error: 'Unauthorized: Invalid webhook token'
  }
}
