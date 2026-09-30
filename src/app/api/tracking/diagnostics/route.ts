import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { maskSecret } from '@/lib/encryption'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, createdAt: true }
    })

    // 1. Tracker & Sessions Diagnostics
    const totalSessions = await prisma.trackingSession.count({
      where: { workspaceId }
    })

    const totalEvents = await prisma.trackingEvent.count({
      where: { workspaceId }
    })

    const lastEvent = await prisma.trackingEvent.findFirst({
      where: { workspaceId },
      orderBy: { eventTime: 'desc' }
    })

    const lastSession = await prisma.trackingSession.findFirst({
      where: { workspaceId },
      orderBy: { firstSeenAt: 'desc' }
    })

    // 2. Pixels Diagnostics
    const pixels = await prisma.pixel.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    })

    const pixelsSummary = pixels.map((p) => ({
      id: p.id,
      name: p.name,
      pixelId: p.pixelId,
      status: p.status,
      environment: p.environment,
      hasCapiToken: Boolean(p.accessTokenEnc),
      maskedToken: p.accessTokenEnc ? maskSecret(p.accessTokenEnc) : null,
      testEventCode: p.testEventCode || null,
      createdAt: p.createdAt
    }))

    // 3. Meta Ads Accounts Diagnostics
    const adAccounts = await prisma.adAccount.findMany({
      where: { workspaceId },
      select: { id: true, name: true, externalId: true, status: true, lastSyncAt: true }
    })

    // 4. Webhook Platforms Diagnostics
    const webhookEvents = await prisma.webhookEvent.groupBy({
      by: ['source', 'status'],
      where: { workspaceId },
      _count: { _all: true }
    })

    const lastWebhook = await prisma.webhookEvent.findFirst({
      where: { workspaceId },
      orderBy: { receivedAt: 'desc' }
    })

    const webhookCountsByPlatform: Record<string, { total: number; processed: number; failed: number }> = {
      hotmart: { total: 0, processed: 0, failed: 0 },
      cakto: { total: 0, processed: 0, failed: 0 },
      kiwify: { total: 0, processed: 0, failed: 0 },
      getfy: { total: 0, processed: 0, failed: 0 },
      yampi: { total: 0, processed: 0, failed: 0 },
      shopify: { total: 0, processed: 0, failed: 0 },
      generic: { total: 0, processed: 0, failed: 0 }
    }

    for (const we of webhookEvents) {
      const p = String(we.source || '').toLowerCase()
      const count = we._count?._all || 0
      if (!webhookCountsByPlatform[p]) {
        webhookCountsByPlatform[p] = { total: 0, processed: 0, failed: 0 }
      }
      webhookCountsByPlatform[p].total += count
      if (we.status === 'processed') webhookCountsByPlatform[p].processed += count
      if (we.status === 'failed') webhookCountsByPlatform[p].failed += count
    }

    // 5. Attribution & Sales Summary
    const totalSales = await prisma.sale.count({
      where: { workspaceId }
    })

    const attributedSales = await prisma.attributionRecord.count({
      where: { workspaceId }
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'https://utm-track-navy.vercel.app')

    return NextResponse.json({
      workspace: {
        id: workspace?.id,
        name: workspace?.name,
        slug: workspace?.slug
      },
      appUrl,
      tracker: {
        isInstalled: totalEvents > 0 || totalSessions > 0,
        status: totalEvents > 0 ? 'ACTIVE' : 'WAITING_EVENTS',
        totalSessions,
        totalEvents,
        lastEvent: lastEvent ? {
          eventName: lastEvent.eventName,
          eventId: lastEvent.eventId,
          eventTime: lastEvent.eventTime,
          sourceUrl: lastEvent.sourceUrl,
          status: lastEvent.status
        } : null,
        lastSession: lastSession ? {
          sessionId: lastSession.sessionId,
          utmSource: lastSession.utmSource,
          utmCampaign: lastSession.utmCampaign,
          fbclid: lastSession.fbclid,
          fbp: lastSession.fbp,
          fbc: lastSession.fbc,
          firstSeenAt: lastSession.firstSeenAt
        } : null,
        scriptSnippet: `<script src="${appUrl}/tracker.js" data-api-url="${appUrl}" data-workspace-id="${workspaceId}" async></script>`
      },
      pixels: {
        total: pixels.length,
        activeCount: pixels.filter(p => p.status === 'active').length,
        list: pixelsSummary
      },
      metaAds: {
        connectedCount: adAccounts.length,
        accounts: adAccounts
      },
      webhooks: {
        summary: webhookCountsByPlatform,
        lastWebhook: lastWebhook ? {
          platform: lastWebhook.source,
          eventType: lastWebhook.eventType,
          status: lastWebhook.status,
          receivedAt: lastWebhook.receivedAt
        } : null
      },
      attribution: {
        totalSales,
        attributedSales,
        attributionRate: totalSales > 0 ? Math.round((attributedSales / totalSales) * 100) : 0
      }
    })
  } catch (error) {
    console.error('Tracking diagnostics error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

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

    const body = await req.json().catch(() => ({}))
    const testType = body.type || 'tracker_ping'
    const now = new Date()

    if (testType === 'tracker_ping') {
      const sessionId = `diag_session_${Date.now()}`
      const eventId = `diag_event_${Date.now()}`

      // Create diagnostic session
      await prisma.trackingSession.create({
        data: {
          sessionId,
          visitorId: `diag_visitor_${Date.now()}`,
          workspaceId,
          utmSource: 'utmtrack_diag',
          utmMedium: 'test',
          utmCampaign: 'diagnostico_painel',
          utmContent: 'ping_teste',
          utmTerm: 'verificacao',
          fbclid: `fb.1.${Date.now()}.diag_click`,
          fbp: `fb.1.${Date.now()}.123456789`,
          fbc: `fb.1.${Date.now()}.diag_click`,
          landingPage: body.sourceUrl || 'https://suapagina.com.br/diagnostico',
          referrer: 'https://utm-track-navy.vercel.app',
          userAgent: 'UTM-Track Diagnostic Ping 1.0',
          firstSeenAt: now,
          lastSeenAt: now
        }
      })

      // Create diagnostic event
      const event = await prisma.trackingEvent.create({
        data: {
          eventId,
          workspaceId,
          sessionId,
          eventName: body.eventName || 'PageView',
          status: 'received',
          sourceUrl: body.sourceUrl || 'https://suapagina.com.br/diagnostico',
          eventTime: now
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Evento de diagnóstico criado com sucesso!',
        testResult: {
          sessionId,
          eventId: event.eventId,
          eventName: event.eventName,
          timestamp: event.eventTime
        }
      })
    }

    return NextResponse.json({ success: true, message: 'Teste concluído.' })
  } catch (error) {
    console.error('Tracking test error:', error)
    return NextResponse.json({ error: 'Erro ao executar teste de rastreamento' }, { status: 500 })
  }
}
