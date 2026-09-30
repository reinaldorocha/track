import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const { id } = await params

    const [sale, notifications] = await Promise.all([
      prisma.sale.findFirst({
        where: {
          id,
          workspaceId,
        },
        include: {
          attributionRecord: true,
        },
      }),
      prisma.notification.findMany({
        where: {
          saleId: id,
          workspaceId,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Check if there is an associated tracking session
    let trackingSession = null
    if (sale.sessionId) {
      trackingSession = await prisma.trackingSession.findUnique({
        where: { sessionId: sale.sessionId },
      })
    } else if (sale.fbclid) {
      trackingSession = await prisma.trackingSession.findFirst({
        where: { workspaceId, fbclid: sale.fbclid },
      })
    } else if (sale.fbp) {
      trackingSession = await prisma.trackingSession.findFirst({
        where: { workspaceId, fbp: sale.fbp },
      })
    }

    const gatewayFee = Math.max(0, sale.grossAmount - sale.netAmount)

    return NextResponse.json({
      sale,
      notifications,
      trackingSession,
      financials: {
        grossAmount: sale.grossAmount,
        gatewayFee,
        netAmount: sale.netAmount,
        currency: sale.currency,
      },
    })
  } catch (error) {
    console.error('Error fetching sale details:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
