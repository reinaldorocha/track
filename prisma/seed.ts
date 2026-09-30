import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // 1. Criar Usuário Demo
  const hashedPassword = await bcrypt.hash('senha123456', 10)
  const user = await prisma.user.upsert({
    where: { email: 'demo@utmtrack.com' },
    update: {},
    create: {
      email: 'demo@utmtrack.com',
      name: 'Demonstração UTM-Track',
      password: hashedPassword,
    }
  })

  console.log('👤 Usuário demo criado: demo@utmtrack.com / senha123456')

  // 2. Criar Workspace Multi-tenant
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'workspace-demo' },
    update: {},
    create: {
      name: 'Workspace Demo',
      slug: 'workspace-demo',
      timezone: 'America/Sao_Paulo',
      currency: 'BRL',
      members: {
        create: {
          userId: user.id,
          role: 'owner'
        }
      }
    }
  })

  console.log('🏢 Workspace criado:', workspace.name)

  // 3. Criar Conta de Anúncios Meta Ads
  const adAccount = await prisma.adAccount.upsert({
    where: {
      workspaceId_externalId: {
        workspaceId: workspace.id,
        externalId: 'act_1020304050'
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      externalId: 'act_1020304050',
      name: 'Conta Principal - Escala',
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      status: 'active',
      lastSyncAt: new Date()
    }
  })

  // 4. Criar Campanha, Conjunto e Anúncio
  const campaign = await prisma.campaign.upsert({
    where: {
      adAccountId_externalId: {
        adAccountId: adAccount.id,
        externalId: 'camp_998877'
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      adAccountId: adAccount.id,
      externalId: 'camp_998877',
      name: 'Black November - Vendas Diretas',
      status: 'ACTIVE',
      objective: 'OUTCOME_SALES',
      dailyBudget: 150.0,
      lastSyncAt: new Date()
    }
  })

  const adSet = await prisma.adSet.upsert({
    where: {
      campaignId_externalId: {
        campaignId: campaign.id,
        externalId: 'adset_112233'
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      externalId: 'adset_112233',
      name: 'Público Aberto - 25-45 anos',
      status: 'ACTIVE',
      dailyBudget: 150.0,
      lastSyncAt: new Date()
    }
  })

  const ad = await prisma.ad.upsert({
    where: {
      adSetId_externalId: {
        adSetId: adSet.id,
        externalId: 'ad_445566'
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      adSetId: adSet.id,
      externalId: 'ad_445566',
      name: 'Vídeo Criativo 01 - Depoimento',
      status: 'ACTIVE',
      lastSyncAt: new Date()
    }
  })

  // 5. Inserir Insights da Campanha (Últimos 7 dias)
  const now = new Date()
  await prisma.campaignInsight.upsert({
    where: {
      campaignId_dateStart_dateStop: {
        campaignId: campaign.id,
        dateStart: new Date(now.getTime() - 7 * 86400000),
        dateStop: now
      }
    },
    update: {},
    create: {
      campaignId: campaign.id,
      dateStart: new Date(now.getTime() - 7 * 86400000),
      dateStop: now,
      spend: 1050.0,
      impressions: 42000,
      reach: 35000,
      clicks: 1680,
      ctr: 4.0,
      cpc: 0.625,
      cpm: 25.0,
      conversions: 42,
      conversionValue: 8274.0
    }
  })

  // 6. Criar Sessão de Tracking com UTM e Meta IDs
  const trackingSession = await prisma.trackingSession.upsert({
    where: { sessionId: 'sess_demo_12345' },
    update: {},
    create: {
      workspaceId: workspace.id,
      sessionId: 'sess_demo_12345',
      visitorId: 'vis_demo_9876',
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: 'Black November - Vendas Diretas',
      utmContent: 'Vídeo Criativo 01 - Depoimento',
      utmTerm: 'aberto_25_45',
      fbclid: 'IwAR_demo_click_id_9999',
      fbp: 'fb.1.1725700000.123456789',
      fbc: 'fb.1.1725700000.IwAR_demo_click_id_9999',
      landingPage: 'https://seusite.com.br/produto',
      referrer: 'https://facebook.com',
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
      adAccountId: adAccount.id
    }
  })

  // 7. Criar Vendas Normalizadas e Atribuídas
  const sale1 = await prisma.sale.upsert({
    where: {
      workspaceId_platform_externalId: {
        workspaceId: workspace.id,
        platform: 'hotmart',
        externalId: 'HP_DEMO_001'
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      platform: 'hotmart',
      externalId: 'HP_DEMO_001',
      status: 'approved',
      grossAmount: 197.0,
      netAmount: 177.3,
      currency: 'BRL',
      utmSource: 'facebook',
      utmCampaign: 'Black November - Vendas Diretas',
      fbclid: 'IwAR_demo_click_id_9999',
      sessionId: trackingSession.sessionId,
      customerEmail: 'cliente1@exemplo.com',
      orderedAt: new Date(now.getTime() - 2 * 3600000),
      approvedAt: new Date(now.getTime() - 2 * 3600000)
    }
  })

  await prisma.attributionRecord.upsert({
    where: { saleId: sale1.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      saleId: sale1.id,
      sessionId: trackingSession.sessionId,
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
      adAccountId: adAccount.id,
      model: 'last_click',
      confidence: 1.0,
      matchedBy: 'fbclid',
      fbclid: 'IwAR_demo_click_id_9999',
      utmCampaign: 'Black November - Vendas Diretas'
    }
  })

  // 8. Criar Despesas Operacionais
  await prisma.expense.createMany({
    data: [
      {
        workspaceId: workspace.id,
        name: 'Assinatura Plataforma Hosting',
        category: 'hosting',
        amount: 150.0,
        date: new Date(),
        recurrence: 'monthly'
      },
      {
        workspaceId: workspace.id,
        name: 'Design de Criativos para Anúncios',
        category: 'creatives',
        amount: 300.0,
        date: new Date(),
        recurrence: 'one_time'
      }
    ]
  })

  // 9. Criar Taxas Cadastradas
  await prisma.fee.createMany({
    data: [
      {
        workspaceId: workspace.id,
        name: 'Taxa Gateway Cartão',
        type: 'gateway',
        percentage: 3.99,
        fixedAmount: 1.0,
        platform: 'hotmart'
      },
      {
        workspaceId: workspace.id,
        name: 'Taxa Checkout Yampi',
        type: 'checkout',
        percentage: 2.5,
        fixedAmount: 0.0,
        platform: 'yampi'
      }
    ]
  })

  // 10. Criar Notificação
  await prisma.notification.create({
    data: {
      workspaceId: workspace.id,
      type: 'sale',
      title: 'Nova venda atribuída!',
      message: 'Venda de R$ 197,00 atribuída com sucesso ao anúncio "Vídeo Criativo 01 - Depoimento".',
      severity: 'success'
    }
  })

  console.log('✅ Seed finalizado com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
