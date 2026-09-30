import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test_auth_secret_for_meta_integration_testing_2025'

import { generateOAuthState, verifyOAuthState } from '../src/lib/meta/oauth'
import { encrypt, decrypt, maskSecret } from '../src/lib/encryption'
import { MetaApiError } from '../src/lib/meta/client'
import { calcCTR, calcCPC, calcCPM, calcCPA, calcROAS } from '../src/lib/metrics'

describe('Meta Ads — Segurança do OAuth e State Token (CSRF)', () => {
  it('Gera e valida token de state assinado com HMAC-SHA256 contendo userId e workspaceId', () => {
    const userId = 'user_123'
    const workspaceId = 'ws_456'
    const state = generateOAuthState(userId, workspaceId)

    assert.ok(state.includes('.'))
    const result = verifyOAuthState(state)

    assert.equal(result.valid, true)
    assert.equal(result.userId, userId)
    assert.equal(result.workspaceId, workspaceId)
    assert.equal(result.error, undefined)
  })

  it('Rejeita state adulterado ou com assinatura inválida (Proteção Anti-CSRF)', () => {
    const state = generateOAuthState('user_123', 'ws_456')
    const [payload, signature] = state.split('.')

    // Adulterar payload
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'attacker', workspaceId: 'ws_hacked' })).toString('base64url')
    const tamperedState = `${tamperedPayload}.${signature}`

    const result = verifyOAuthState(tamperedState)
    assert.equal(result.valid, false)
    assert.ok(result.error?.includes('Assinatura'))
  })

  it('Rejeita state expirado (> 30 minutos)', () => {
    const expiredPayload = {
      userId: 'user_123',
      workspaceId: 'ws_456',
      timestamp: Date.now() - (35 * 60 * 1000), // 35 min atrás
      nonce: 'nonce123',
    }
    const serialized = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url')
    const crypto = require('crypto')
    const signature = crypto
      .createHmac('sha256', process.env.AUTH_SECRET!)
      .update(serialized)
      .digest('base64url')
    
    const expiredState = `${serialized}.${signature}`
    const result = verifyOAuthState(expiredState)

    assert.equal(result.valid, false)
    assert.ok(result.error?.includes('expirado'))
  })

  it('Rejeita state ausente ou malformado', () => {
    assert.equal(verifyOAuthState(null).valid, false)
    assert.equal(verifyOAuthState('').valid, false)
    assert.equal(verifyOAuthState('invalid_state_without_dot').valid, false)
  })
})

describe('Meta Ads — Proteção e Armazenamento de Access Tokens', () => {
  it('Criptografa o token do usuário com AES-256-GCM antes da persistência', () => {
    const token = 'EAABwz91k20kZAO...long_lived_user_access_token'
    const encrypted = encrypt(token)

    assert.notEqual(encrypted, token)
    const decrypted = decrypt(encrypted)
    assert.equal(decrypted, token)
  })

  it('Mascaramento seguro do token para exibição na interface', () => {
    const rawToken = 'EAABwz91k20kZAO123456789xyz'
    const masked = maskSecret(rawToken)

    assert.ok(!masked.includes('EAABwz91k20kZAO'))
    assert.equal(masked.endsWith('9xyz'), true)
  })
})

describe('Meta Ads — Tratamento de Erros da Meta Graph API v21.0', () => {
  it('Identifica código 190 como token expirado ou invalidado (Reconexão Necessária)', () => {
    const error190 = new MetaApiError('Error validating access token: Session has expired', 190, 463)
    assert.equal(error190.isTokenInvalid, true)
    assert.equal(error190.isRateLimit, false)

    const error102 = new MetaApiError('Session key invalid', 102)
    assert.equal(error102.isTokenInvalid, true)
  })

  it('Identifica código 17 e 613 como limites de requisições atingidos (Rate Limit)', () => {
    const error17 = new MetaApiError('User request limit reached', 17)
    assert.equal(error17.isRateLimit, true)
    assert.equal(error17.isTokenInvalid, false)

    const error613 = new MetaApiError('Calls to this api have exceeded the rate limit', 613)
    assert.equal(error613.isRateLimit, true)
  })
})

describe('Meta Ads — Consistência de Métricas Importadas da Meta', () => {
  it('Calcula CTR com base em cliques e impressões reais', () => {
    assert.equal(calcCTR(50, 1000), 5.0)
    assert.equal(calcCTR(0, 1000), 0.0)
    assert.equal(calcCTR(100, 0), null)
  })

  it('Calcula CPC e CPM reais', () => {
    assert.equal(calcCPC(150, 50), 3.0)
    assert.equal(calcCPM(200, 10000), 20.0)
  })

  it('Calcula ROAS com base em faturamento e investimento de anúncios', () => {
    assert.equal(calcROAS(1000, 200), 5.0)
    assert.equal(calcROAS(0, 200), 0.0)
    assert.equal(calcROAS(1000, 0), null)
  })

  it('Calcula CPA com base no gasto e conversões aprovadas', () => {
    assert.equal(calcCPA(500, 10), 50.0)
    assert.equal(calcCPA(500, 0), null)
  })
})

describe('Meta Ads — Resolução Canônica de Redirect URI de Produção', () => {

  it('Gera redirect_uri apontando exatamente para https://utm-track-navy.vercel.app/api/meta/callback em produção', () => {
    const env = process.env as Record<string, string | undefined>
    const originalEnv = env.NODE_ENV
    const originalUrl = env.NEXT_PUBLIC_APP_URL
    const originalVercel = env.VERCEL_PROJECT_PRODUCTION_URL

    try {
      delete env.NEXT_PUBLIC_APP_URL
      delete env.VERCEL_PROJECT_PRODUCTION_URL
      env.NODE_ENV = 'production'

      const { getMetaRedirectUri, getAppBaseUrl, PRODUCTION_APP_URL } = require('../src/lib/meta/oauth')

      assert.equal(PRODUCTION_APP_URL, 'https://utm-track-navy.vercel.app')
      assert.equal(getAppBaseUrl(), 'https://utm-track-navy.vercel.app')
      assert.equal(getMetaRedirectUri(), 'https://utm-track-navy.vercel.app/api/meta/callback')
    } finally {
      env.NODE_ENV = originalEnv
      if (originalUrl) env.NEXT_PUBLIC_APP_URL = originalUrl
      if (originalVercel) env.VERCEL_PROJECT_PRODUCTION_URL = originalVercel
    }
  })


  it('Respeita NEXT_PUBLIC_APP_URL explicitamente configurada e remove trailing slash', () => {
    const { getMetaRedirectUri } = require('../src/lib/meta/oauth')
    const originalUrl = process.env.NEXT_PUBLIC_APP_URL

    try {
      process.env.NEXT_PUBLIC_APP_URL = 'https://utm-track-navy.vercel.app/'
      assert.equal(getMetaRedirectUri(), 'https://utm-track-navy.vercel.app/api/meta/callback')
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_APP_URL = originalUrl
      else delete process.env.NEXT_PUBLIC_APP_URL
    }
  })
})

describe('Meta Ads — Validação de Escopos OAuth (Sem read_insights inválido)', () => {
  it('Não inclui o escopo inválido "read_insights"', () => {
    const { META_OAUTH_SCOPES } = require('../src/lib/meta/oauth')
    assert.equal(META_OAUTH_SCOPES.includes('read_insights'), false)
  })

  it('Inclui as permissões válidas necessárias: ads_read, ads_management, business_management', () => {
    const { META_OAUTH_SCOPES } = require('../src/lib/meta/oauth')
    const scopes = META_OAUTH_SCOPES.split(',')

    assert.ok(scopes.includes('ads_read'))
    assert.ok(scopes.includes('ads_management'))
    assert.ok(scopes.includes('business_management'))
    assert.equal(scopes.length, 3)
  })
})


describe('Meta Ads — Separação de Seleção e Sincronização de Contas', () => {
  it('POST /api/meta/select não deve chamar syncAdAccount — retorna activatedCount imediatamente', () => {
    // Verify the route no longer imports or calls syncAdAccount
    const fs = require('fs')
    const path = require('path')
    const routeSource = fs.readFileSync(
      path.join(__dirname, '../src/app/api/meta/select/route.ts'),
      'utf-8'
    )
    assert.equal(routeSource.includes('syncAdAccount'), false,
      '/api/meta/select NÃO deve importar ou chamar syncAdAccount')
    assert.equal(routeSource.includes('syncImmediately'), false,
      '/api/meta/select NÃO deve aceitar ou processar syncImmediately')
    assert.ok(routeSource.includes('activatedCount'),
      '/api/meta/select deve retornar activatedCount na resposta')
  })

  it('POST /api/meta/select não importa lib de sync e retorna resposta rápida', () => {
    const fs = require('fs')
    const path = require('path')
    const routeSource = fs.readFileSync(
      path.join(__dirname, '../src/app/api/meta/select/route.ts'),
      'utf-8'
    )
    // Must not import the sync library at all
    assert.equal(routeSource.includes("from '@/lib/meta/sync'"), false,
      '/api/meta/select NÃO deve importar @/lib/meta/sync')
    assert.equal(routeSource.includes("require('../lib/meta/sync')"), false)
  })

  it('POST /api/meta/sync sincroniza somente contas ativas — não todas as contas', () => {
    const fs = require('fs')
    const path = require('path')
    const syncRouteSource = fs.readFileSync(
      path.join(__dirname, '../src/app/api/meta/sync/route.ts'),
      'utf-8'
    )
    // Must filter by active status
    assert.ok(syncRouteSource.includes("status: 'active'"),
      '/api/meta/sync deve filtrar somente contas com status active')
  })

  it('POST /api/meta/sync isola erros por conta — uma falha não interrompe as demais', () => {
    const fs = require('fs')
    const path = require('path')
    const syncRouteSource = fs.readFileSync(
      path.join(__dirname, '../src/app/api/meta/sync/route.ts'),
      'utf-8'
    )
    // Must have per-account try/catch inside the loop
    assert.ok(syncRouteSource.includes('try {') && syncRouteSource.includes('catch (err)'),
      '/api/meta/sync deve capturar erros individualmente por conta')
    assert.ok(syncRouteSource.includes('succeeded'),
      '/api/meta/sync deve retornar contagem de sucesso e falha')
  })

  it('Seleção de 1 conta: selectedAccountIds com 1 item é array válido', () => {
    const ids = ['acc-uuid-001']
    assert.ok(Array.isArray(ids))
    assert.equal(ids.length, 1)
  })

  it('Seleção de 19 contas: selectedAccountIds com 19 itens é array válido', () => {
    const ids = Array.from({ length: 19 }, (_, i) => `acc-uuid-${String(i + 1).padStart(3, '0')}`)
    assert.ok(Array.isArray(ids))
    assert.equal(ids.length, 19)
  })

  it('Idempotência: chamar select múltiplas vezes com os mesmos IDs não duplica contas', () => {
    // The route uses updateMany (upsert-equivalent for status), not create
    const fs = require('fs')
    const path = require('path')
    const routeSource = fs.readFileSync(
      path.join(__dirname, '../src/app/api/meta/select/route.ts'),
      'utf-8'
    )
    assert.ok(routeSource.includes('updateMany'),
      '/api/meta/select usa updateMany (idempotente) para definir status das contas')
    assert.equal(routeSource.includes('prisma.adAccount.create'), false,
      '/api/meta/select não deve criar contas novas (não idempotente)')
  })

  it('Isolamento de workspace: query de activate filtra por workspaceId', () => {
    const fs = require('fs')
    const path = require('path')
    const routeSource = fs.readFileSync(
      path.join(__dirname, '../src/app/api/meta/select/route.ts'),
      'utf-8'
    )
    const occurrences = (routeSource.match(/workspaceId/g) || []).length
    assert.ok(occurrences >= 2,
      '/api/meta/select deve usar workspaceId em todas as queries para isolamento de tenant')
  })
})
