import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_VISIBLE_WIDGETS,
  WIDGET_CATALOG,
  PREDEFINED_LAYOUTS,
  getLayoutWidgets,
} from '../src/components/summary/customize-widgets-modal'

test('Dashboard Customization: catálogo de widgets e configuração padrão', async (t) => {
  await t.test('1. Deve conter pelo menos 35 widgets catalogados estilo UTMFY', () => {
    assert.ok(WIDGET_CATALOG.length >= 35, 'Catalogados: ' + WIDGET_CATALOG.length)
  })

  await t.test('2. Novos quadros de Produto, SRC, Vendas/Dia e Dia da Semana devem constar no catálogo', () => {
    const productWidget = WIDGET_CATALOG.find(w => w.id === 'productSales')
    const srcWidget = WIDGET_CATALOG.find(w => w.id === 'srcDistribution')
    const dailyWidget = WIDGET_CATALOG.find(w => w.id === 'dailyChart')
    const weekdayWidget = WIDGET_CATALOG.find(w => w.id === 'weekdaySales')

    assert.ok(productWidget, 'Widget productSales deve existir')
    assert.strictEqual(productWidget?.title, 'Vendas / Faturamento por Produto')
    assert.ok(srcWidget, 'Widget srcDistribution deve existir')
    assert.strictEqual(srcWidget?.title, 'Vendas por SRC (Sub-origem)')
    assert.ok(dailyWidget, 'Widget dailyChart deve existir')
    assert.strictEqual(dailyWidget?.title, 'Vendas / Dia (Evolução Diária)')
    assert.ok(weekdayWidget, 'Widget weekdaySales deve existir')
    assert.strictEqual(weekdayWidget?.title, 'Vendas por Dia da Semana')
  })

  await t.test('3. DEFAULT_VISIBLE_WIDGETS deve ter todos os quadros ativos por padrão', () => {
    assert.strictEqual(DEFAULT_VISIBLE_WIDGETS.productSales, true)
    assert.strictEqual(DEFAULT_VISIBLE_WIDGETS.srcDistribution, true)
    assert.strictEqual(DEFAULT_VISIBLE_WIDGETS.dailyChart, true)
    assert.strictEqual(DEFAULT_VISIBLE_WIDGETS.weekdaySales, true)
    assert.strictEqual(DEFAULT_VISIBLE_WIDGETS.grossRevenue, true)
    assert.strictEqual(DEFAULT_VISIBLE_WIDGETS.adSpend, true)
    assert.strictEqual(DEFAULT_VISIBLE_WIDGETS.profit, true)
  })

  await t.test('4. Layouts pré-definidos: Básico, Completo, Tráfego, Financeiro, WhatsApp', () => {
    assert.strictEqual(PREDEFINED_LAYOUTS.length, 5)

    // Básico
    const basico = getLayoutWidgets('basico')
    assert.strictEqual(basico.grossRevenue, true, 'Básico tem faturamento bruto')
    assert.strictEqual(basico.netRevenue, true, 'Básico tem faturamento líquido')
    assert.strictEqual(basico.adSpend, true, 'Básico tem gastos Meta Ads')
    assert.strictEqual(basico.profit, true, 'Básico tem lucro real')
    assert.strictEqual(basico.fees, true, 'Básico tem taxas gateway')
    assert.strictEqual(basico.expenses, true, 'Básico tem despesas')
    assert.strictEqual(basico.impostoVendas, true, 'Básico tem imposto')
    assert.strictEqual(basico.impostoMeta, true, 'Básico tem imposto meta ads')
    assert.strictEqual(basico.roas, true, 'Básico tem roas')
    assert.strictEqual(basico.dailyChart, true, 'Básico tem vendas por dia')
    assert.strictEqual(basico.productSales, true, 'Básico tem produtos')
    assert.strictEqual(basico.cpm, false, 'Básico desativa cpm secundário')
    assert.strictEqual(basico.refunds, false, 'Básico desativa refunds secundário')

    // Completo
    const completo = getLayoutWidgets('completo')
    assert.strictEqual(completo.cpm, true, 'Completo ativa cpm')
    assert.strictEqual(completo.refunds, true, 'Completo ativa refunds')
    assert.strictEqual(completo.funnel, true, 'Completo ativa funnel')
    assert.strictEqual(completo.expenses, true, 'Completo ativa despesas')

    // Tráfego
    const trafego = getLayoutWidgets('trafego')
    assert.strictEqual(trafego.cpa, true)
    assert.strictEqual(trafego.cpc, true)
    assert.strictEqual(trafego.funnel, true)
    assert.strictEqual(trafego.fees, false)
    assert.strictEqual(trafego.impostoMeta, true, 'Tráfego deve ter imposto de anúncios')
    assert.strictEqual(trafego.profit, false, 'Tráfego não deve ter lucro real')

    // Financeiro
    const financeiro = getLayoutWidgets('financeiro')
    assert.strictEqual(financeiro.fees, true)
    assert.strictEqual(financeiro.expenses, true)
    assert.strictEqual(financeiro.refunds, true)
    assert.strictEqual(financeiro.chargebacks, true)

    // WhatsApp
    const whatsapp = getLayoutWidgets('whatsapp')
    assert.strictEqual(whatsapp.leads, true)
    assert.strictEqual(whatsapp.conversas, true)
    assert.strictEqual(whatsapp.cpl, true)
  })
})

test('Agrupamento de Produtos e SRC: lógica analítica', async (t) => {
  await t.test('1. Cálculo de ranking de produtos por faturamento bruto e ticket médio', () => {
    const mockSales = [
      {
        id: 's1',
        grossAmount: 197,
        netAmount: 180,
        items: [{ id: 'i1', productId: 'p1', name: 'Curso de Tráfego', quantity: 1, totalPrice: 197, unitPrice: 197 }]
      },
      {
        id: 's2',
        grossAmount: 197,
        netAmount: 180,
        items: [{ id: 'i2', productId: 'p1', name: 'Curso de Tráfego', quantity: 1, totalPrice: 197, unitPrice: 197 }]
      },
      {
        id: 's3',
        grossAmount: 97,
        netAmount: 90,
        items: [{ id: 'i3', productId: 'p2', name: 'E-book Estratégico', quantity: 1, totalPrice: 97, unitPrice: 97 }]
      }
    ]

    const productMap = new Map<string, { id: string; name: string; salesCount: number; grossRevenue: number; netRevenue: number }>()

    for (const sale of mockSales) {
      for (const item of sale.items) {
        const prodKey = item.productId || item.name
        const cur = productMap.get(prodKey) || {
          id: prodKey,
          name: item.name,
          salesCount: 0,
          grossRevenue: 0,
          netRevenue: 0
        }
        cur.salesCount += item.quantity
        cur.grossRevenue += item.totalPrice
        cur.netRevenue += sale.netAmount * (item.totalPrice / sale.grossAmount)
        productMap.set(prodKey, cur)
      }
    }

    const totalGross = 197 + 197 + 97
    const result = Array.from(productMap.values()).map(p => ({
      ...p,
      avgTicket: p.salesCount > 0 ? p.grossRevenue / p.salesCount : 0,
      percentage: (p.grossRevenue / totalGross) * 100
    })).sort((a, b) => b.grossRevenue - a.grossRevenue)

    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0].name, 'Curso de Tráfego')
    assert.strictEqual(result[0].salesCount, 2)
    assert.strictEqual(result[0].grossRevenue, 394)
    assert.strictEqual(result[0].avgTicket, 197)
    assert.strictEqual(result[1].name, 'E-book Estratégico')
    assert.strictEqual(result[1].salesCount, 1)
  })

  await t.test('2. Extração e agrupamento de parâmetro SRC', () => {
    const mockSales = [
      { id: 's1', grossAmount: 100, utmContent: 'src=stories_bio', utmSource: 'instagram' },
      { id: 's2', grossAmount: 150, utmContent: 'src=stories_bio', utmSource: 'instagram' },
      { id: 's3', grossAmount: 200, utmContent: 'whatsapp_grupo', utmSource: 'whatsapp' },
      { id: 's4', grossAmount: 50, utmContent: null, utmSource: null }
    ]

    const srcMap = new Map<string, { count: number; revenue: number }>()
    for (const s of mockSales) {
      let srcVal = 'nenhum'
      if (s.utmContent && (s.utmContent.startsWith('src=') || s.utmContent.startsWith('sck='))) {
        srcVal = s.utmContent.split('=')[1] || s.utmContent
      } else if (s.utmContent) {
        srcVal = s.utmContent
      } else if (s.utmSource) {
        srcVal = s.utmSource
      }
      srcVal = srcVal.trim() || 'direto'

      const cur = srcMap.get(srcVal) || { count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += s.grossAmount
      srcMap.set(srcVal, cur)
    }

    const totalGross = 500
    const result = Array.from(srcMap.entries()).map(([src, item]) => ({
      name: src,
      count: item.count,
      revenue: item.revenue,
      percentage: (item.revenue / totalGross) * 100
    })).sort((a, b) => b.revenue - a.revenue)

    assert.strictEqual(result.length, 3)
    assert.strictEqual(result[0].name, 'stories_bio')
    assert.strictEqual(result[0].count, 2)
    assert.strictEqual(result[0].revenue, 250)
    assert.strictEqual(result[1].name, 'whatsapp_grupo')
    assert.strictEqual(result[1].revenue, 200)
    assert.strictEqual(result[2].name, 'nenhum')
    assert.strictEqual(result[2].revenue, 50)
  })

  await t.test('3. Taxas de Reembolso e Chargeback', () => {
    const totalSales = 100
    const refunds = 4
    const chargebacks = 1

    const taxaReembolso = Number(((refunds / totalSales) * 100).toFixed(1))
    const taxaChargeback = Number(((chargebacks / totalSales) * 100).toFixed(1))

    assert.strictEqual(taxaReembolso, 4.0)
    assert.strictEqual(taxaChargeback, 1.0)
  })

  await t.test('4. Agrupamento de Vendas por Dia da Semana (0 a 6)', () => {
    // 2026-09-28 foi Segunda-feira (1), 2026-09-29 foi Terça-feira (2)
    const mockSales = [
      { id: 's1', grossAmount: 200, orderedAt: new Date('2026-09-28T10:00:00Z') }, // Seg (1)
      { id: 's2', grossAmount: 300, orderedAt: new Date('2026-09-28T14:00:00Z') }, // Seg (1)
      { id: 's3', grossAmount: 150, orderedAt: new Date('2026-09-29T09:00:00Z') }, // Ter (2)
    ]

    const weekdayMap = new Map<number, { dayIndex: number; salesCount: number; grossRevenue: number }>()
    for (let i = 0; i < 7; i++) {
      weekdayMap.set(i, { dayIndex: i, salesCount: 0, grossRevenue: 0 })
    }

    for (const s of mockSales) {
      const idx = s.orderedAt.getUTCDay()
      const item = weekdayMap.get(idx)!
      item.salesCount += 1
      item.grossRevenue += s.grossAmount
    }

    const seg = weekdayMap.get(1)!
    const ter = weekdayMap.get(2)!
    const dom = weekdayMap.get(0)!

    assert.strictEqual(seg.salesCount, 2)
    assert.strictEqual(seg.grossRevenue, 500)
    assert.strictEqual(ter.salesCount, 1)
    assert.strictEqual(ter.grossRevenue, 150)
    assert.strictEqual(dom.salesCount, 0)
    assert.strictEqual(dom.grossRevenue, 0)
  })
})
