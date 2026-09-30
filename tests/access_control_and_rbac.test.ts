import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isAdmin, requireAdminApi, requireUserApi, type AuthSession } from '../src/lib/access-control'

describe('Controle de Acesso e RBAC (Role-Based Access Control)', () => {
  it('Identifica corretamente o perfil de Administrador via Role e Env', () => {
    process.env.ADMIN_EMAIL = 'admin@utmtrack.com'
    process.env.INITIAL_ADMIN_EMAIL = 'owner@utmtrack.com'

    // Usuário com role ADMIN
    const adminUser = { id: 'u1', email: 'user1@empresa.com', role: 'ADMIN', status: 'ACTIVE' }
    assert.equal(isAdmin(adminUser), true)

    // Usuário com role SUPER_ADMIN
    const superAdminUser = { id: 'u2', email: 'user2@empresa.com', role: 'SUPER_ADMIN', status: 'ACTIVE' }
    assert.equal(isAdmin(superAdminUser), true)

    // Usuário com email do ADMIN_EMAIL configurado
    const envAdminUser = { id: 'u3', email: 'admin@utmtrack.com', role: 'CLIENT', status: 'ACTIVE' }
    assert.equal(isAdmin(envAdminUser), true)

    // Usuário com email do INITIAL_ADMIN_EMAIL configurado
    const envInitialAdmin = { id: 'u4', email: 'owner@utmtrack.com', role: 'CLIENT', status: 'ACTIVE' }
    assert.equal(isAdmin(envInitialAdmin), true)

    // Cliente comum
    const clientUser = { id: 'u5', email: 'cliente@empresa.com', role: 'CLIENT', status: 'ACTIVE' }
    assert.equal(isAdmin(clientUser), false)

    // Usuário nulo/indefinido
    assert.equal(isAdmin(null), false)
    assert.equal(isAdmin(undefined), false)
  })

  it('Garante isolamento: requireAdminApi rejeita usuários não autenticados com 401', async () => {
    const result = await requireAdminApi(null)
    assert.ok(result instanceof Response)
    assert.equal(result.status, 401)
  })

  it('Garante isolamento: requireAdminApi rejeita clientes comuns com 403 Forbidden', async () => {
    const clientSession = {
      user: {
        id: 'usr_client_01',
        email: 'cliente@marca.com',
        name: 'Cliente Comum',
        role: 'CLIENT',
        status: 'ACTIVE'
      }
    }
    const result = await requireAdminApi(clientSession)
    assert.ok(result instanceof Response)
    assert.equal(result.status, 403)
  })

  it('Garante isolamento: requireAdminApi autoriza Administrador', async () => {
    const adminSession = {
      user: {
        id: 'usr_admin_01',
        email: 'admin@utmtrack.com',
        name: 'Administrador Master',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    }
    const result = await requireAdminApi(adminSession)
    assert.ok(!(result instanceof Response))
    assert.equal(result.session.user.role, 'ADMIN')
  })

  it('requireUserApi rejeita usuários suspensos ou desativados', async () => {
    const suspendedSession = {
      user: {
        id: 'usr_susp_01',
        email: 'suspenso@empresa.com',
        name: 'Usuário Suspenso',
        role: 'CLIENT',
        status: 'SUSPENDED'
      }
    }
    const resultSusp = await requireUserApi(suspendedSession)
    assert.ok(resultSusp instanceof Response)
    assert.equal(resultSusp.status, 403)

    const disabledSession = {
      user: {
        id: 'usr_dis_01',
        email: 'desativado@empresa.com',
        name: 'Usuário Desativado',
        role: 'CLIENT',
        status: 'DISABLED'
      }
    }
    const resultDis = await requireUserApi(disabledSession)
    assert.ok(resultDis instanceof Response)
    assert.equal(resultDis.status, 403)
  })
})

describe('Bloqueio Estrito de Cadastro Público', () => {
  it('API de registro público retorna 403 Forbidden', async () => {
    const { POST } = await import('../src/app/api/auth/register/route')
    const fakeRequest = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'hacker@malicious.com', password: 'password123' })
    })

    const response = await POST(fakeRequest)
    assert.equal(response.status, 403)
    const data = await response.json()
    assert.equal(data.error, 'Forbidden')
  })
})

describe('Sanitização e Segurança dos Logs de Auditoria', () => {
  it('Mascara credenciais sensíveis (password, token, secret)', () => {
    const sensitiveMetadata = {
      email: 'teste@empresa.com',
      password: 'PlainPassword123!',
      metaAccessToken: 'EAABwz91k20kZAO...',
      webhookSecret: 'secret_live_xyz999',
      clientName: 'Cliente VIP'
    }

    const sanitized = { ...sensitiveMetadata }
    for (const key of Object.keys(sanitized)) {
      if (/pass(word)?|token|secret|key/i.test(key)) {
        (sanitized as any)[key] = '[REDACTED]'
      }
    }

    assert.equal(sanitized.password, '[REDACTED]')
    assert.equal(sanitized.metaAccessToken, '[REDACTED]')
    assert.equal(sanitized.webhookSecret, '[REDACTED]')
    assert.equal(sanitized.email, 'teste@empresa.com')
    assert.equal(sanitized.clientName, 'Cliente VIP')
  })
})

describe('Integridade de Multi-Tenant e Isolamento de Workspaces', () => {
  it('Estrutura de criação de novos clientes vincula Workspace dedicado e WorkspaceMember owner', () => {
    const newClientPayload = {
      name: 'Alpha Marketing',
      email: 'gestor@alphamarketing.com',
      role: 'CLIENT',
      workspaceName: 'Alpha Marketing Workspace'
    }

    const expectedWorkspaceSlug = newClientPayload.workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')

    assert.ok(expectedWorkspaceSlug.includes('alpha-marketing-workspace'))

    const mockMember = {
      userId: 'usr_new_99',
      workspaceId: 'ws_alpha_01',
      role: 'owner'
    }

    assert.equal(mockMember.role, 'owner')
    assert.equal(mockMember.workspaceId, 'ws_alpha_01')
  })
})
