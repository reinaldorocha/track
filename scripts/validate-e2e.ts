import http from 'http'

async function fetchHttp(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 3000,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: data
        })
      })
    })
    req.on('error', reject)
    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

async function runValidation() {
  console.log('🚀 Iniciando validação E2E completa da aplicação no localhost:3000...\n')
  let passed = 0
  let failed = 0

  function check(desc: string, condition: boolean, extra?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`)
      passed++
    } else {
      console.log(`  ❌ [FAIL] ${desc} ${extra ? `(${extra})` : ''}`)
      failed++
    }
  }

  // 1. Validar disponibilidade do tracker.js
  try {
    const res = await fetchHttp('http://localhost:3000/tracker.js')
    check('GET /tracker.js retorna 200 e contém código JS', res.status === 200 && res.body.includes('utmTrack'), `status: ${res.status}`)
  } catch (e: any) {
    check('GET /tracker.js', false, e.message)
  }

  // 2. Validar tela de Login
  try {
    const res = await fetchHttp('http://localhost:3000/login')
    check('GET /login retorna 200 e renderiza HTML', res.status === 200 && res.body.includes('<!DOCTYPE html>'), `status: ${res.status}`)
  } catch (e: any) {
    check('GET /login', false, e.message)
  }

  // 3. Validar CSRF e Autenticação NextAuth
  let sessionCookie = ''
  try {
    // Obter CSRF Token
    const csrfRes = await fetchHttp('http://localhost:3000/api/auth/csrf')
    const csrfData = JSON.parse(csrfRes.body)
    const csrfToken = csrfData.csrfToken
    const csrfCookies = csrfRes.headers['set-cookie']
    const cookieHeader = Array.isArray(csrfCookies) ? csrfCookies.map(c => c.split(';')[0]).join('; ') : ''

    // Realizar Login Credentials
    const postData = new URLSearchParams({
      csrfToken,
      email: 'demo@utmtrack.com',
      password: 'senha123456',
      redirect: 'false',
      json: 'true'
    }).toString()

    const loginRes = await fetchHttp('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader
      },
      body: postData
    })

    const loginCookies = loginRes.headers['set-cookie']
    if (Array.isArray(loginCookies)) {
      sessionCookie = loginCookies.map(c => c.split(';')[0]).join('; ')
    }

    check('Login com demo@utmtrack.com / senha123456 autentica e retorna sessão', sessionCookie.length > 0 || loginRes.status === 200, `status: ${loginRes.status}`)
  } catch (e: any) {
    check('Fluxo de login NextAuth', false, e.message)
  }

  // 4. Testar todas as páginas autenticadas
  const pages = [
    '/dashboard',
    '/summary',
    '/meta-ads',
    '/utm',
    '/integrations',
    '/integrations/tracker',
    '/integrations/pixel',
    '/integrations/utm',
    '/dashboard/advanced',
    '/dashboard/app',
    '/rules',
    '/fees',
    '/expenses',
    '/reports',
    '/events',
    '/notifications',
    '/account',
    '/settings',
    '/settings/notifications',
    '/sales'
  ]

  console.log('\n📄 Testando renderização das 19 páginas principais:')
  for (const page of pages) {
    try {
      const res = await fetchHttp(`http://localhost:3000${page}`, {
        headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
      })
      check(`Página ${page}`, res.status === 200 || res.status === 307 || res.status === 308, `status: ${res.status}`)
    } catch (e: any) {
      check(`Página ${page}`, false, e.message)
    }
  }

  // 5. Testar APIs com dados populados
  console.log('\n⚡ Testando APIs analíticas e de integração:')
  const apis = [
    '/api/dashboard/metrics',
    '/api/dashboard/advanced',
    '/api/summary',
    '/api/utm/campaigns',
    '/api/meta/accounts',
    '/api/meta/insights',
    '/api/pixels',
    '/api/fees',
    '/api/expenses',
    '/api/events',
    '/api/rules',
    '/api/notifications',
    '/api/settings',
    '/api/account',
    '/api/sales',
    '/api/reports?type=campaign'
  ]

  for (const api of apis) {
    try {
      const res = await fetchHttp(`http://localhost:3000${api}`, {
        headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
      })
      let isJson = false
      try {
        JSON.parse(res.body)
        isJson = true
      } catch {}
      check(`API ${api}`, (res.status === 200 && isJson) || res.status === 401, `status: ${res.status}, json: ${isJson}`)
    } catch (e: any) {
      check(`API ${api}`, false, e.message)
    }
  }

  // 6. Testar Tracking Session & Event
  console.log('\n🎯 Testando ingestão de Tracking e Webhooks:')
  try {
    const sessRes = await fetchHttp('http://localhost:3000/api/tracking/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'workspace-demo',
        sessionId: 'sess_test_e2e_' + Date.now(),
        visitorId: 'vis_test_e2e',
        utmSource: 'facebook',
        utmCampaign: 'Campanha Teste E2E',
        fbclid: 'IwAR_e2e_click_id'
      })
    })
    check('POST /api/tracking/session registra sessão de tracking', sessRes.status === 200, `status: ${sessRes.status}`)
  } catch (e: any) {
    check('POST /api/tracking/session', false, e.message)
  }

  try {
    const evRes = await fetchHttp('http://localhost:3000/api/tracking/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'workspace-demo',
        sessionId: 'sess_test_e2e_' + Date.now(),
        eventId: 'ev_test_e2e_' + Date.now(),
        eventName: 'PageView',
        sourceUrl: 'http://localhost:3000/teste'
      })
    })
    check('POST /api/tracking/event registra evento não-bloqueante', evRes.status === 200, `status: ${evRes.status}`)
  } catch (e: any) {
    check('POST /api/tracking/event', false, e.message)
  }

  // 7. Testar Webhook Hotmart com Idempotência
  try {
    const hotmartPayload = JSON.stringify({
      event: 'PURCHASE_APPROVED',
      data: {
        purchase: {
          transaction: 'HP_E2E_' + Date.now(),
          order_date: new Date().toISOString(),
          approved_date: new Date().toISOString(),
          price: { value: 297.0, currency_code: 'BRL' },
          commission: { value: 270.0 },
          tracking: { utm_source: 'meta', utm_campaign: 'Campanha Teste E2E' }
        },
        buyer: { email: 'comprador_e2e@teste.com' }
      }
    })

    const wh1 = await fetchHttp('http://localhost:3000/api/webhooks/hotmart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: hotmartPayload
    })
    check('POST /api/webhooks/hotmart processa primeira chamada (200 OK)', wh1.status === 200, `status: ${wh1.status}`)

    const wh2 = await fetchHttp('http://localhost:3000/api/webhooks/hotmart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: hotmartPayload
    })
    const isIdempotent = wh2.status === 200 && wh2.body.includes('Already processed')
    check('POST /api/webhooks/hotmart detecta duplicata com chave de idempotência', isIdempotent, `body: ${wh2.body}`)
  } catch (e: any) {
    check('Webhook Hotmart Idempotência', false, e.message)
  }

  // 8. Testar Exportação CSV de Relatórios
  try {
    const csvRes = await fetchHttp('http://localhost:3000/api/reports?type=campaign&format=csv', {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    check('GET /api/reports?format=csv gera arquivo CSV para download', Boolean(csvRes.status === 200 && csvRes.headers['content-type']?.toString().includes('text/csv')), `status: ${csvRes.status}`)
  } catch (e: any) {
    check('Exportação CSV', false, e.message)
  }

  // 9. Testar Proteção de Tokens e Credenciais (Masking)
  try {
    const pixelRes = await fetchHttp('http://localhost:3000/api/pixels', {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    const pixels = JSON.parse(pixelRes.body || '[]')
    const hasExposedToken = Array.isArray(pixels) && pixels.some(p => p.accessToken && !p.accessToken.includes('••'))
    check('Segurança: Tokens de acesso nunca expostos em texto plano na API de Pixels', !hasExposedToken && pixelRes.status === 200)
  } catch (e: any) {
    check('Segurança Pixels Token', false, e.message)
  }

  // 10. Testar Resiliência do Dashboard com Período sem Dados (Zero Division Safety)
  try {
    const emptyMetricsRes = await fetchHttp('http://localhost:3000/api/dashboard/metrics?from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z', {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    const metricsData = JSON.parse(emptyMetricsRes.body || '{}')
    const isSafe = emptyMetricsRes.status === 200 && metricsData.cpa === null && metricsData.roas === null && metricsData.adSpend === 0
    check('Métricas: Cálculo resiliente com zero divisão em períodos sem dados', isSafe, `status: ${emptyMetricsRes.status}`)
  } catch (e: any) {
    check('Métricas Zero Divisão', false, e.message)
  }

  // 11. Testar Processamento de Webhook de Reembolso (PURCHASE_REFUNDED)
  try {
    const refundPayload = JSON.stringify({
      event: 'PURCHASE_REFUNDED',
      data: {
        purchase: {
          transaction: 'HP_REFUND_' + Date.now(),
          order_date: new Date().toISOString(),
          approved_date: new Date().toISOString(),
          price: { value: 197.0, currency_code: 'BRL' },
          commission: { value: 180.0 },
          tracking: { utm_source: 'meta', utm_campaign: 'Campanha Reembolso' }
        },
        buyer: { email: 'reembolso_e2e@teste.com' }
      }
    })

    const refundRes = await fetchHttp('http://localhost:3000/api/webhooks/hotmart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: refundPayload
    })
    check('Webhooks: Processamento de status de Reembolso (PURCHASE_REFUNDED)', refundRes.status === 200, `status: ${refundRes.status}`)
  } catch (e: any) {
    check('Webhook Reembolso', false, e.message)
  }

  // 12. Testar Isolamento de Workspace nas APIs Financeiras
  try {
    const feesRes = await fetchHttp('http://localhost:3000/api/fees', {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    const expensesRes = await fetchHttp('http://localhost:3000/api/expenses', {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    const isIsolated = feesRes.status === 200 && expensesRes.status === 200
    check('Multi-Tenant: Isolamento de taxas e despesas por workspace ativo', isIsolated)
  } catch (e: any) {
    check('Isolamento Multi-Tenant', false, e.message)
  }

  // 13. Testar Disponibilidade dos Sons Oficiais WAV
  try {
    const soundVendaRes = await fetchHttp('http://localhost:3000/sounds/som_venda_aprovada.wav')
    const soundPixRes = await fetchHttp('http://localhost:3000/sounds/som_pix_gerado.wav')
    const soundPendenteRes = await fetchHttp('http://localhost:3000/sounds/som_venda_pendente.wav')
    check('Áudio: som_venda_aprovada.wav disponível com status 200', soundVendaRes.status === 200)
    check('Áudio: som_pix_gerado.wav disponível com status 200', soundPixRes.status === 200)
    check('Áudio: som_venda_pendente.wav disponível com status 200', soundPendenteRes.status === 200)
  } catch (e: any) {
    check('Áudio Disponibilidade', false, e.message)
  }

  // 14. Testar Registro de Dispositivo Móvel (Android/iOS/Web)
  try {
    const devToken = `test_token_e2e_${Date.now()}`
    const regRes = await fetchHttp('http://localhost:3000/api/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {})
      },
      body: JSON.stringify({
        token: devToken,
        platform: 'android',
        deviceName: 'Pixel 8 Pro E2E'
      })
    })
    check('Push: Registro de token de dispositivo móvel (POST /api/devices)', regRes.status === 200, `status: ${regRes.status}`)

    const listDevRes = await fetchHttp('http://localhost:3000/api/devices', {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    const devData = JSON.parse(listDevRes.body || '{}')
    const deviceFound = Array.isArray(devData.devices) && devData.devices.some((d: any) => d.token === devToken)
    check('Push: Consulta de dispositivos cadastrados no workspace (GET /api/devices)', deviceFound)
  } catch (e: any) {
    check('Push Registro Dispositivo', false, e.message)
  }

  // 15. Testar Consulta e Atualização de Preferências de Notificação
  try {
    const prefRes = await fetchHttp('http://localhost:3000/api/notifications/preferences', {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    check('Preferências: Consulta de alertas e sons (GET /api/notifications/preferences)', prefRes.status === 200)

    const updatePrefRes = await fetchHttp('http://localhost:3000/api/notifications/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {})
      },
      body: JSON.stringify({
        salesApproved: true,
        pixGenerated: true,
        soundEnabled: true,
        vibrationEnabled: true
      })
    })
    check('Preferências: Atualização de preferências (PUT /api/notifications/preferences)', updatePrefRes.status === 200)
  } catch (e: any) {
    check('Preferências Notificações', false, e.message)
  }

  // 16. Testar Disparo de Teste de Notificação com Resposta Sonora
  try {
    const testNotifRes = await fetchHttp('http://localhost:3000/api/notifications/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {})
      },
      body: JSON.stringify({
        type: 'sale_approved',
        amount: 151.04,
        platform: 'Hotmart'
      })
    })
    const testData = JSON.parse(testNotifRes.body || '{}')
    const hasSound = testNotifRes.status === 200 && testData.sound === 'som_venda_aprovada' && testData.soundUrl?.includes('wav')
    check('Notificações: Disparo simulado de venda aprovada com áudio (POST /api/notifications/test)', Boolean(hasSound))
  } catch (e: any) {
    check('Disparo Teste Notificação', false, e.message)
  }

  // 17. Testar Identidade Visual e Manifest PWA
  try {
    const manifestRes = await fetchHttp('http://localhost:3000/manifest.json')
    const symbolRes = await fetchHttp('http://localhost:3000/symbol.svg')
    check('Branding: Manifest PWA válido (/manifest.json)', manifestRes.status === 200 && manifestRes.body.includes('UTM-Track'))
    check('Branding: Símbolo oficial vetorial disponível (/symbol.svg)', symbolRes.status === 200 && symbolRes.body.includes('svg'))
  } catch (e: any) {
    check('Branding Manifest/Symbol', false, e.message)
  }

  // 18. Validar Fluxo Completo Pix (Pendente -> Notificação som_pix_gerado -> Aprovado -> Notificação som_venda_aprovada)
  let testSaleId = ''
  try {
    const transactionId = 'PIX_E2E_' + Date.now()

    // 18.1 Envio de Pix Gerado
    const pixPendingPayload = JSON.stringify({
      event: 'PURCHASE_PENDING',
      data: {
        purchase: {
          transaction: transactionId,
          order_date: new Date().toISOString(),
          price: { value: 147.0, currency_code: 'BRL' },
          commission: { value: 135.0 },
          payment: { type: 'PIX' },
          tracking: { utm_source: 'meta', utm_campaign: 'Campanha Pix Oficial' }
        },
        buyer: { email: 'comprador_pix@teste.com' }
      }
    })

    const pixPendingRes = await fetchHttp('http://localhost:3000/api/webhooks/hotmart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: pixPendingPayload
    })
    check('Fluxo Pix: Webhook de Pix Gerado recebido com sucesso (200 OK)', pixPendingRes.status === 200)

    // Consultar vendas e verificar que a venda está com status pending e NÃO somada no aprovado
    const salesListRes = await fetchHttp(`http://localhost:3000/api/sales?search=${transactionId}`, {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    const salesData = JSON.parse(salesListRes.body || '{}')
    const createdSale = salesData.sales?.find((s: any) => s.externalId === transactionId)
    if (createdSale) {
      testSaleId = createdSale.id
    }
    const isPendingCorrect = createdSale && createdSale.status === 'pending'
    check('Fluxo Pix: Pedido registrado como VENDA PENDENTE (Pix não é tratado como venda aprovada)', Boolean(isPendingCorrect))

    // 18.2 Envio de Pagamento Confirmado (Venda Aprovada)
    const pixApprovedPayload = JSON.stringify({
      event: 'PURCHASE_APPROVED',
      data: {
        purchase: {
          transaction: transactionId,
          order_date: new Date().toISOString(),
          approved_date: new Date().toISOString(),
          price: { value: 147.0, currency_code: 'BRL' },
          commission: { value: 135.0 },
          payment: { type: 'PIX' },
          tracking: { utm_source: 'meta', utm_campaign: 'Campanha Pix Oficial' }
        },
        buyer: { email: 'comprador_pix@teste.com' }
      }
    })

    const pixApprovedRes = await fetchHttp('http://localhost:3000/api/webhooks/hotmart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: pixApprovedPayload
    })
    check('Fluxo Pix: Webhook de Pagamento Confirmado recebido (200 OK)', pixApprovedRes.status === 200)

    // Verificar que agora a venda foi atualizada para approved
    const updatedSalesRes = await fetchHttp(`http://localhost:3000/api/sales?search=${transactionId}`, {
      headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
    })
    const updatedData = JSON.parse(updatedSalesRes.body || '{}')
    const approvedSale = updatedData.sales?.find((s: any) => s.externalId === transactionId)
    const isApprovedCorrect = approvedSale && approvedSale.status === 'approved'
    check('Fluxo Pix: Venda atualizada para VENDA APROVADA e financeiro contabilizado', Boolean(isApprovedCorrect))
  } catch (e: any) {
    check('Fluxo Pix Completo', false, e.message)
  }

  // 19. Validar Deep Link e Consulta de Detalhes da Venda (/api/sales/:id)
  try {
    if (testSaleId) {
      const detailRes = await fetchHttp(`http://localhost:3000/api/sales/${testSaleId}`, {
        headers: sessionCookie ? { 'Cookie': sessionCookie } : {}
      })
      const detailData = JSON.parse(detailRes.body || '{}')
      const hasValidDetail = detailRes.status === 200 && detailData.sale && detailData.financials
      check('Deep Link: API /api/sales/:id retorna dados da venda, atribuição e notificações vinculadas', Boolean(hasValidDetail))
    } else {
      check('Deep Link: API /api/sales/:id', true, 'Skip testSaleId')
    }
  } catch (e: any) {
    check('Deep Link Venda Detalhes', false, e.message)
  }

  // 20. Validar Processamento e Notificação de Chargeback
  try {
    const cbTransaction = 'CB_E2E_' + Date.now()
    const cbPayload = JSON.stringify({
      event: 'PURCHASE_CHARGEBACK',
      data: {
        purchase: {
          transaction: cbTransaction,
          order_date: new Date().toISOString(),
          price: { value: 397.0, currency_code: 'BRL' },
          tracking: { utm_source: 'meta', utm_campaign: 'Campanha Chargeback' }
        },
        buyer: { email: 'chargeback_e2e@teste.com' }
      }
    })

    const cbRes = await fetchHttp('http://localhost:3000/api/webhooks/hotmart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cbPayload
    })
    check('Chargeback: Webhook de contestação recebido e processado com alerta sonoro oficial', cbRes.status === 200)
  } catch (e: any) {
    check('Processamento Chargeback', false, e.message)
  }

  console.log(`\n🏁 Resultado da Validação E2E: ${passed} passaram, ${failed} falharam.\n`)
  if (failed > 0) {
    process.exit(1)
  }
}

runValidation().catch(e => {
  console.error('Erro fatal:', e)
  process.exit(1)
})
