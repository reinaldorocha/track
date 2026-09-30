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
      // O token DEVE bater estritamente com o segredo exclusivo desta integração
      if (token === integration.webhookSecret) {
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

    // Se a integração NÃO tem segredo próprio cadastrado:
    // O segredo global do ENV só autoriza se este for o workspace padrão do sistema
    const defaultWorkspace = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
    const isDefaultWorkspace = defaultWorkspace?.id === workspace.id

    if (globalEnvSecret && token === globalEnvSecret && isDefaultWorkspace) {
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
      error: `Unauthorized: Webhook secret not configured or does not match workspace ${workspace.id}`
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

  // 3.2 Se o token bate com o segredo global em ENV, aplica APENAS ao workspace padrão
  if (globalEnvSecret && token === globalEnvSecret) {
    const defaultWs = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
    if (defaultWs) {
      const defaultIntegration = await prisma.integration.findFirst({
        where: {
          workspaceId: defaultWs.id,
          platform: { in: [platform, platform.toLowerCase()] }
        }
      })
      // Se a integração do workspace padrão tiver um webhookSecret próprio diferente, NÃO aceita o global
      if (defaultIntegration?.webhookSecret && defaultIntegration.webhookSecret !== token) {
        return {
          authorized: false,
          status: 401,
          error: 'Unauthorized: Default workspace uses custom webhook secret'
        }
      }

      return {
        authorized: true,
        status: 200,
        workspaceId: defaultWs.id,
        integrationId: defaultIntegration?.id
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
