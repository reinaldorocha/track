import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
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

    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')
    const platform = searchParams.get('platform')
    const timeZone = searchParams.get('timeZone') || 'America/Sao_Paulo'

    // Determinar range de datas (default: hoje 00:00 até 23:59:59 em America/Sao_Paulo)
    let fromDate: Date
    let toDate: Date

    if (fromStr && toStr) {
      fromDate = new Date(fromStr)
      toDate = new Date(toStr)
    } else if (fromStr) {
      fromDate = new Date(fromStr)
      toDate = new Date()
    } else {
      // Default: últimos 7 dias até agora
      toDate = new Date()
      fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }

    const where: any = {
      workspaceId,
      orderedAt: {
        gte: fromDate,
        lte: toDate,
      },
    }

    if (platform && platform !== 'all') {
      where.platform = platform.toLowerCase()
    }

    // Buscar todas as vendas dentro do período selecionado
    const sales = await prisma.sale.findMany({
      where,
      select: {
        id: true,
        orderedAt: true,
        status: true,
        grossAmount: true,
        netAmount: true,
        paymentMethod: true,
        platform: true,
      },
      orderBy: { orderedAt: 'asc' },
    })

    // Inicializar os 24 baldes horários (00:00 às 23:00)
    const hourlyBuckets = Array.from({ length: 24 }, (_, i) => {
      const hourStr = String(i).padStart(2, '0')
      return {
        hour: i,
        label: `${hourStr}:00`,
        shortLabel: `${hourStr}h`,
        grossRevenue: 0,
        netRevenue: 0,
        approvedCount: 0,
        pendingCount: 0,
        refundedCount: 0,
        totalOrders: 0,
        pixCount: 0,
        cardCount: 0,
        boletoCount: 0,
        otherMethodCount: 0,
        avgTicket: 0,
        approvalRate: 0,
      }
    })

    // Formatador de fuso horário seguro
    const hourFormatter = new Intl.DateTimeFormat('pt-BR', {
      hour: 'numeric',
      hour12: false,
      timeZone,
    })

    let totalGross = 0
    let totalNet = 0
    let totalApprovedCount = 0
    let totalPendingCount = 0
    let totalRefundedCount = 0
    let totalPixCount = 0
    let totalCardCount = 0

    for (const s of sales) {
      let localHour = 0
      try {
        const parts = hourFormatter.formatToParts(s.orderedAt)
        const hourPart = parts.find((p) => p.type === 'hour')
        localHour = hourPart ? parseInt(hourPart.value, 10) : s.orderedAt.getUTCHours()
      } catch {
        localHour = s.orderedAt.getHours()
      }

      // Normalizar hour para range 0..23
      if (localHour >= 24) localHour = 0
      if (localHour < 0 || isNaN(localHour)) localHour = 0

      const bucket = hourlyBuckets[localHour]
      bucket.totalOrders += 1

      // Mapear meio de pagamento
      const pMethod = String(s.paymentMethod || '').toLowerCase()
      if (pMethod.includes('pix')) {
        bucket.pixCount += 1
        totalPixCount += 1
      } else if (pMethod.includes('card') || pMethod.includes('cartao') || pMethod.includes('credit')) {
        bucket.cardCount += 1
        totalCardCount += 1
      } else if (pMethod.includes('boleto')) {
        bucket.boletoCount += 1
      } else {
        bucket.otherMethodCount += 1
      }

      // Status
      if (s.status === 'approved') {
        bucket.grossRevenue += s.grossAmount
        bucket.netRevenue += s.netAmount
        bucket.approvedCount += 1

        totalGross += s.grossAmount
        totalNet += s.netAmount
        totalApprovedCount += 1
      } else if (s.status === 'pending') {
        bucket.pendingCount += 1
        totalPendingCount += 1
      } else if (s.status === 'refunded' || s.status === 'chargeback') {
        bucket.refundedCount += 1
        totalRefundedCount += 1
      }
    }

    // Calcular métricas derivadas por balde (ticket médio e taxa de aprovação)
    let bestHour = 0
    let maxHourRevenue = -1
    let peakOrdersHour = 0
    let maxOrdersCount = -1
    let peakPixHour = 0
    let maxPixCount = -1
    let peakCardHour = 0
    let maxCardCount = -1

    for (const b of hourlyBuckets) {
      b.grossRevenue = Math.round(b.grossRevenue * 100) / 100
      b.netRevenue = Math.round(b.netRevenue * 100) / 100

      if (b.approvedCount > 0) {
        b.avgTicket = Math.round((b.grossRevenue / b.approvedCount) * 100) / 100
      }

      const relevantTotal = b.approvedCount + b.pendingCount
      if (relevantTotal > 0) {
        b.approvalRate = Math.round((b.approvedCount / relevantTotal) * 1000) / 10
      }

      // Identificar destaques (Golden Hour)
      if (b.grossRevenue > maxHourRevenue) {
        maxHourRevenue = b.grossRevenue
        bestHour = b.hour
      }
      if (b.approvedCount > maxOrdersCount) {
        maxOrdersCount = b.approvedCount
        peakOrdersHour = b.hour
      }
      if (b.pixCount > maxPixCount) {
        maxPixCount = b.pixCount
        peakPixHour = b.hour
      }
      if (b.cardCount > maxCardCount) {
        maxCardCount = b.cardCount
        peakCardHour = b.hour
      }
    }

    const overallRelevant = totalApprovedCount + totalPendingCount
    const overallApprovalRate =
      overallRelevant > 0 ? Math.round((totalApprovedCount / overallRelevant) * 1000) / 10 : 0

    return NextResponse.json({
      success: true,
      timeZone,
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      summary: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalApprovedCount,
        totalPendingCount,
        totalRefundedCount,
        totalPixCount,
        totalCardCount,
        overallApprovalRate,
        goldenHour: {
          bestHour,
          bestHourLabel: `${String(bestHour).padStart(2, '0')}:00 - ${String(bestHour).padStart(2, '0')}:59`,
          bestHourRevenue: maxHourRevenue > 0 ? maxHourRevenue : 0,
          peakOrdersHour,
          peakOrdersHourLabel: `${String(peakOrdersHour).padStart(2, '0')}:00 - ${String(peakOrdersHour).padStart(2, '0')}:59`,
          peakPixHour,
          peakPixHourLabel: `${String(peakPixHour).padStart(2, '0')}:00 - ${String(peakPixHour).padStart(2, '0')}:59`,
          peakCardHour,
          peakCardHourLabel: `${String(peakCardHour).padStart(2, '0')}:00 - ${String(peakCardHour).padStart(2, '0')}:59`,
        },
      },
      hourly: hourlyBuckets,
    })
  } catch (error: any) {
    console.error('Error in /api/sales/hourly:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar distribuição horária de vendas' },
      { status: 500 }
    )
  }
}
