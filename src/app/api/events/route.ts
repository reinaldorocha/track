import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'all'
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    let combinedEvents: Array<{
      id: string
      eventType: string
      source: string
      status: string
      createdAt: Date
      details: string
    }> = []
    let total = 0

    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)
    const hasDateFilter = from || to

    if (type === 'tracking' || type === 'all') {
      const tracking = await prisma.trackingEvent.findMany({
        where: {
          workspaceId,
          ...(status ? { status } : {}),
          ...(hasDateFilter ? { createdAt: dateFilter } : {})
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
      
      const trackingTotal = await prisma.trackingEvent.count({
        where: {
          workspaceId,
          ...(status ? { status } : {}),
          ...(hasDateFilter ? { createdAt: dateFilter } : {})
        }
      })

      tracking.forEach((t) => {
        combinedEvents.push({
          id: t.id,
          eventType: t.eventName,
          source: 'pixel',
          status: t.status,
          createdAt: t.createdAt,
          details: t.sourceUrl || ''
        })
      })
      total += trackingTotal
    }

    if (type === 'webhook' || type === 'all') {
      const webhooks = await prisma.webhookEvent.findMany({
        where: {
          workspaceId,
          ...(status ? { status } : {}),
          ...(hasDateFilter ? { receivedAt: dateFilter } : {})
        },
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
      
      const webhookTotal = await prisma.webhookEvent.count({
        where: {
          workspaceId,
          ...(status ? { status } : {}),
          ...(hasDateFilter ? { receivedAt: dateFilter } : {})
        }
      })

      webhooks.forEach((w) => {
        combinedEvents.push({
          id: w.id,
          eventType: w.eventType || 'webhook',
          source: w.source,
          status: w.status,
          createdAt: w.receivedAt,
          details: w.payload
        })
      })
      total += webhookTotal
    }

    combinedEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    combinedEvents = combinedEvents.slice(0, limit)

    return NextResponse.json({ 
      events: combinedEvents, 
      total, 
      page, 
      pages: Math.ceil(total / limit) 
    })
  } catch (error) {
    console.error('Events error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
