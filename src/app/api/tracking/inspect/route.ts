import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await req.json()
    let rawUrl = String(body.url || '').trim()

    if (!rawUrl) {
      return NextResponse.json({ error: 'Informe a URL da página para inspecionar' }, { status: 400 })
    }

    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = `https://${rawUrl}`
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(rawUrl)
    } catch {
      return NextResponse.json({ error: 'URL inválida. Verifique o formato digitado.' }, { status: 400 })
    }

    const startTime = Date.now()
    let html = ''
    let httpStatus = 0
    let statusText = ''
    let responseTimeMs = 0
    let isHttps = parsedUrl.protocol === 'https:'

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 UTMTrackInspector/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000), // 12s timeout
      })

      httpStatus = response.status
      statusText = response.statusText
      responseTimeMs = Date.now() - startTime
      html = await response.text()
    } catch (fetchErr: any) {
      responseTimeMs = Date.now() - startTime
      return NextResponse.json({
        success: false,
        url: parsedUrl.toString(),
        httpStatus: 0,
        error: `Não foi possível acessar a página: ${fetchErr.message || 'Timeout ou erro de conexão'}`,
        responseTimeMs,
        score: 0,
        checks: [
          {
            name: 'Conexão HTTP & SSL',
            status: 'failed',
            message: `Falha de conexão com ${parsedUrl.hostname}`,
          },
        ],
      })
    }

    // 1. Verificação do Tracker.js
    const hasTrackerScript = /tracker\.js/i.test(html)
    const hasWorkspaceId = html.includes(workspaceId)
    const hasDataApiUrl = /data-api-url/i.test(html)

    // 2. Verificação do Meta Pixel
    const hasMetaPixelFbq = /fbq\s*\(\s*['"]init['"]/i.test(html) || /connect\.facebook\.net\/.*\/fbevents\.js/i.test(html)
    const pixelIdMatches = html.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/i)
    const detectedPixelId = pixelIdMatches ? pixelIdMatches[1] : null

    // 3. Verificação de Gateways de Checkout
    const checkoutKeywords = [
      { name: 'Kiwify', pattern: /kiwify\.com\.br/i },
      { name: 'Hotmart', pattern: /hotmart\.com/i },
      { name: 'Cakto', pattern: /cakto\.com\.br|cacto\.com\.br/i },
      { name: 'Getfy', pattern: /getfy\.com|getfy\.cloud/i },
      { name: 'Yampi', pattern: /yampi\.io|yampi\.com\.br/i },
      { name: 'Shopify', pattern: /myshopify\.com|checkout/i },
      { name: 'Eduzz', pattern: /eduzz\.com/i },
      { name: 'Braip', pattern: /braip\.com/i },
      { name: 'Kirvano', pattern: /kirvano\.com/i },
      { name: 'Monetizze', pattern: /monetizze\.com\.br/i },
    ]

    const detectedCheckouts: Array<{ platform: string; count: number }> = []
    const linkMatches = html.match(/href\s*=\s*["']([^"']+)["']/gi) || []

    for (const ck of checkoutKeywords) {
      let count = 0
      for (const linkAttr of linkMatches) {
        if (ck.pattern.test(linkAttr)) {
          count++
        }
      }
      if (count > 0) {
        detectedCheckouts.push({ platform: ck.name, count })
      }
    }

    // 4. Montar Diagnóstico e Pontuação (Score de 0 a 100)
    const checks: Array<{
      id: string
      name: string
      status: 'success' | 'warning' | 'failed'
      title: string
      details: string
    }> = []

    let score = 0

    // Check A: Acessibilidade HTTP & SSL (20 pts)
    if (httpStatus >= 200 && httpStatus < 300) {
      if (isHttps) {
        score += 20
        checks.push({
          id: 'http_ssl',
          name: 'Acessibilidade & SSL',
          status: 'success',
          title: `Página online com SSL seguro (HTTP ${httpStatus})`,
          details: `Tempo de resposta: ${responseTimeMs}ms. O certificado HTTPS é válido.`,
        })
      } else {
        score += 10
        checks.push({
          id: 'http_ssl',
          name: 'Acessibilidade & SSL',
          status: 'warning',
          title: 'Página online sem HTTPS seguro',
          details: 'A página respondeu HTTP 200, mas não usa HTTPS criptografado.',
        })
      }
    } else {
      checks.push({
        id: 'http_ssl',
        name: 'Acessibilidade & SSL',
        status: 'failed',
        title: `Página retornou código de erro HTTP ${httpStatus} (${statusText})`,
        details: 'Verifique se a URL está correta e com a página publicada no ar.',
      })
    }

    // Check B: Instalação do Tracker.js (40 pts)
    if (hasTrackerScript && hasWorkspaceId) {
      score += 40
      checks.push({
        id: 'tracker_script',
        name: 'Script do Tracker.js',
        status: 'success',
        title: 'Tracker.js instalado e configurado perfeitamente!',
        details: `Identificado data-workspace-id correspondente ao seu workspace (${workspaceId.substring(0, 10)}...).`,
      })
    } else if (hasTrackerScript && !hasWorkspaceId) {
      score += 20
      checks.push({
        id: 'tracker_script',
        name: 'Script do Tracker.js',
        status: 'warning',
        title: 'Tracker.js encontrado, mas com Workspace ID diferente',
        details: 'O script está no código, porém o atributo data-workspace-id não confere com este workspace.',
      })
    } else {
      checks.push({
        id: 'tracker_script',
        name: 'Script do Tracker.js',
        status: 'failed',
        title: 'Tracker.js NÃO foi encontrado no código da página',
        details: 'Insira a tag <script src=".../tracker.js" ...></script> dentro da tag <head> do seu site.',
      })
    }

    // Check C: Meta Pixel no Navegador (20 pts)
    if (hasMetaPixelFbq) {
      score += 20
      checks.push({
        id: 'meta_pixel',
        name: 'Meta Pixel (Facebook)',
        status: 'success',
        title: `Meta Pixel ativo no navegador${detectedPixelId ? ` (ID: ${detectedPixelId})` : ''}`,
        details: 'O código do Pixel foi detectado e disparará eventos com deduplicação para a CAPI.',
      })
    } else {
      checks.push({
        id: 'meta_pixel',
        name: 'Meta Pixel (Facebook)',
        status: 'warning',
        title: 'Meta Pixel não detectado no código-fonte',
        details: 'Recomendamos manter o Pixel do Facebook ativo junto com o Tracker para máxima deduplicação CAPI.',
      })
    }

    // Check D: Botões de Checkout (20 pts)
    if (detectedCheckouts.length > 0) {
      score += 20
      const totalLinks = detectedCheckouts.reduce((acc, c) => acc + c.count, 0)
      const platformsStr = detectedCheckouts.map((c) => `${c.platform} (${c.count})`).join(', ')
      checks.push({
        id: 'checkout_buttons',
        name: 'Botões de Checkout',
        status: 'success',
        title: `${totalLinks} link(s) de checkout detectados: ${platformsStr}`,
        details: 'O Tracker.js interceptará e injetará automaticamente as UTMs e fbclid nestes botões.',
      })
    } else {
      checks.push({
        id: 'checkout_buttons',
        name: 'Botões de Checkout',
        status: 'warning',
        title: 'Nenhum link de checkout padrão identificado no HTML',
        details:
          'Se você utiliza um gateway próprio ou iframe, adicione seu domínio no atributo data-checkout-domains do script.',
      })
    }

    // 5. Gerar Link de Teste com Token Único Rastreável
    const testToken = `iw_live_${Date.now()}`
    const testUrlObj = new URL(parsedUrl.toString())
    testUrlObj.searchParams.set('utm_source', 'meta_test')
    testUrlObj.searchParams.set('utm_medium', 'cpc')
    testUrlObj.searchParams.set('utm_campaign', 'teste_inspector_ao_vivo')
    testUrlObj.searchParams.set('utm_content', 'anuncio_verificacao')
    testUrlObj.searchParams.set('fbclid', testToken)

    return NextResponse.json({
      success: true,
      url: parsedUrl.toString(),
      httpStatus,
      responseTimeMs,
      score,
      isHttps,
      checks,
      detectedPixelId,
      detectedCheckouts,
      testToken,
      testUrl: testUrlObj.toString(),
      summary:
        score >= 80
          ? 'Excelente! Seu rastreamento está pronto para rodar anúncios com atribuição real.'
          : score >= 50
          ? 'Rastreamento parcialmente configurado. Ajuste os pontos de atenção para não perder vendas.'
          : 'Atenção: Instale o script do Tracker.js para que o sistema possa rastrear e atribuir vendas.',
    })
  } catch (error: any) {
    console.error('Error in /api/tracking/inspect:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar inspeção de rastreamento' },
      { status: 500 }
    )
  }
}

// Endpoint para ouvir em tempo real se o clique do link de teste foi registrado no banco
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token de teste obrigatório' }, { status: 400 })
    }

    // Procurar por sessão com o fbclid do teste nos últimos 15 minutos
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    const liveSession = await prisma.trackingSession.findFirst({
      where: {
        workspaceId,
        fbclid: token,
        firstSeenAt: { gte: fifteenMinutesAgo },
      },
      include: {
        events: {
          orderBy: { eventTime: 'desc' },
          take: 5,
        },
      },
    })

    if (liveSession) {
      return NextResponse.json({
        detected: true,
        session: {
          sessionId: liveSession.sessionId,
          visitorId: liveSession.visitorId,
          utmSource: liveSession.utmSource,
          utmCampaign: liveSession.utmCampaign,
          landingPage: liveSession.landingPage,
          ipAddress: liveSession.ipAddress,
          firstSeenAt: liveSession.firstSeenAt,
          eventsCount: liveSession.events.length,
          lastEventName: liveSession.events[0]?.eventName || 'PageView',
        },
      })
    }

    return NextResponse.json({ detected: false })
  } catch (error: any) {
    console.error('Error in GET /api/tracking/inspect:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
