import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test_auth_secret_for_inspector_2025'

describe('Live Link Inspector (Testador de Rastreamento ao Vivo)', () => {
  it('1. Valida normalização e formatação da URL de inspeção', () => {
    let url = 'minhaloja.com.br/vendas'
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }
    const parsed = new URL(url)
    assert.equal(parsed.protocol, 'https:')
    assert.equal(parsed.hostname, 'minhaloja.com.br')
    assert.equal(parsed.pathname, '/vendas')
  })

  it('2. Detecta presença do script tracker.js e conferência do data-workspace-id', () => {
    const workspaceId = 'cl_test_workspace_999'
    const htmlWithCorrectScript = `
      <html>
        <head>
          <script src="https://track.meudominio.com/tracker.js" data-workspace-id="${workspaceId}"></script>
        </head>
      </html>
    `
    const hasTrackerScript = /tracker\.js/i.test(htmlWithCorrectScript)
    const hasWorkspaceId = htmlWithCorrectScript.includes(workspaceId)
    assert.ok(hasTrackerScript, 'Deve detectar tracker.js')
    assert.ok(hasWorkspaceId, 'Deve validar correspondência do workspaceId')

    const htmlWithoutScript = '<html><head><title>Página sem rastreio</title></head></html>'
    assert.ok(!/tracker\.js/i.test(htmlWithoutScript), 'Não deve achar script quando ausente')
  })

  it('3. Detecta Pixel da Meta e extrai o Pixel ID com regex', () => {
    const htmlWithPixel = `
      <script>
        !function(f,b,e,v,n,t,s){...}(window, document,'script');
        fbq('init', '987654321098765');
        fbq('track', 'PageView');
      </script>
    `
    const hasMetaPixelFbq = /fbq\s*\(\s*['"]init['"]/i.test(htmlWithPixel)
    const pixelIdMatches = htmlWithPixel.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/i)
    const detectedPixelId = pixelIdMatches ? pixelIdMatches[1] : null

    assert.ok(hasMetaPixelFbq)
    assert.equal(detectedPixelId, '987654321098765')
  })

  it('4. Mapeia links de botões de checkout para múltiplas plataformas', () => {
    const htmlWithCheckoutButtons = `
      <div>
        <a href="https://pay.kiwify.com.br/abc123">Comprar na Kiwify</a>
        <a href="https://pay.hotmart.com/XYZ999">Comprar na Hotmart</a>
        <a href="https://checkout.cakto.com.br/p/12345">Comprar no Cakto</a>
        <a href="https://checkout.getfy.com/order/6789">Comprar no Getfy</a>
      </div>
    `
    const checkoutKeywords = [
      { name: 'Kiwify', pattern: /kiwify\.com\.br/i },
      { name: 'Hotmart', pattern: /hotmart\.com/i },
      { name: 'Cakto', pattern: /cakto\.com\.br|cacto\.com\.br/i },
      { name: 'Getfy', pattern: /getfy\.com|getfy\.cloud/i },
      { name: 'Yampi', pattern: /yampi\.io|yampi\.com\.br/i },
    ]

    const linkMatches = htmlWithCheckoutButtons.match(/href\s*=\s*["']([^"']+)["']/gi) || []
    const detected: string[] = []

    for (const ck of checkoutKeywords) {
      if (linkMatches.some(attr => ck.pattern.test(attr))) {
        detected.push(ck.name)
      }
    }

    assert.deepEqual(detected, ['Kiwify', 'Hotmart', 'Cakto', 'Getfy'])
  })

  it('5. Gera link de simulação ao vivo com parâmetros de teste rastreáveis', () => {
    const baseUrl = 'https://lp.meuproduto.com.br/oferta'
    const testToken = `iw_live_${Date.now()}`
    const testUrlObj = new URL(baseUrl)
    testUrlObj.searchParams.set('utm_source', 'meta_test')
    testUrlObj.searchParams.set('utm_medium', 'cpc')
    testUrlObj.searchParams.set('utm_campaign', 'teste_inspector_ao_vivo')
    testUrlObj.searchParams.set('fbclid', testToken)

    const finalUrl = testUrlObj.toString()
    assert.ok(finalUrl.includes('utm_source=meta_test'))
    assert.ok(finalUrl.includes(`fbclid=${testToken}`))
    assert.ok(finalUrl.includes('teste_inspector_ao_vivo'))
  })
})

describe('Relatório de Vendas por Hora do Dia (Hourly Sales Breakdown)', () => {
  it('1. Inicializa exatamente 24 baldes horários (00h a 23h)', () => {
    const hourlyBuckets = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}:00`,
      grossRevenue: 0,
      netRevenue: 0,
      approvedCount: 0,
      pendingCount: 0,
      pixCount: 0,
      cardCount: 0,
    }))

    assert.equal(hourlyBuckets.length, 24)
    assert.equal(hourlyBuckets[0].label, '00:00')
    assert.equal(hourlyBuckets[23].label, '23:00')
  })

  it('2. Agrupa vendas por hora e separa meios de pagamento corretamente', () => {
    const mockSales = [
      { hour: 14, status: 'approved', gross: 197.0, net: 180.0, method: 'pix' },
      { hour: 14, status: 'approved', gross: 297.0, net: 270.0, method: 'credit_card' },
      { hour: 14, status: 'pending', gross: 97.0, net: 90.0, method: 'pix' },
      { hour: 20, status: 'approved', gross: 497.0, net: 450.0, method: 'credit_card' },
      { hour: 20, status: 'approved', gross: 197.0, net: 180.0, method: 'card' },
    ]

    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      grossRevenue: 0,
      approvedCount: 0,
      pendingCount: 0,
      pixCount: 0,
      cardCount: 0,
    }))

    for (const sale of mockSales) {
      const b = buckets[sale.hour]
      if (sale.status === 'approved') {
        b.grossRevenue += sale.gross
        b.approvedCount += 1
      } else {
        b.pendingCount += 1
      }

      if (sale.method.includes('pix')) b.pixCount += 1
      if (sale.method.includes('card')) b.cardCount += 1
    }

    // Validação da hora 14
    assert.equal(buckets[14].approvedCount, 2)
    assert.equal(buckets[14].pendingCount, 1)
    assert.equal(buckets[14].grossRevenue, 494.0) // 197 + 297
    assert.equal(buckets[14].pixCount, 2)
    assert.equal(buckets[14].cardCount, 1)

    // Validação da hora 20
    assert.equal(buckets[20].approvedCount, 2)
    assert.equal(buckets[20].grossRevenue, 694.0) // 497 + 197
    assert.equal(buckets[20].cardCount, 2)
  })

  it('3. Identifica com precisão a Golden Hour (Melhor Horário de Faturamento)', () => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      grossRevenue: i === 19 ? 5420.0 : i === 20 ? 3200.0 : 100.0,
      approvedCount: i === 19 ? 28 : 2,
    }))

    let bestHour = 0
    let maxHourRevenue = -1
    for (const b of buckets) {
      if (b.grossRevenue > maxHourRevenue) {
        maxHourRevenue = b.grossRevenue
        bestHour = b.hour
      }
    }

    assert.equal(bestHour, 19, 'O horário das 19h deve ser identificado como a Golden Hour')
    assert.equal(maxHourRevenue, 5420.0)
  })

  it('4. Calcula taxa de conversão / aprovação hora a hora', () => {
    const approved = 8
    const pending = 2
    const total = approved + pending
    const rate = Math.round((approved / total) * 1000) / 10

    assert.equal(rate, 80.0, 'Taxa de aprovação deve ser 80%')
  })
})
