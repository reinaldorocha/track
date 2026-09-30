import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { decrypt } from '@/lib/encryption'
import { MetaApiClient } from '@/lib/meta/client'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 404 })
    }

    const body = await req.json()
    const {
      level, // 'campaign' | 'adset' | 'ad'
      id,
      suffix = ' - Cópia',
    } = body

    if (!level || !id) {
      return NextResponse.json({ error: 'Parâmetros level e id são obrigatórios' }, { status: 400 })
    }

    if (level === 'campaign') {
      const campaign = await prisma.campaign.findFirst({
        where: {
          workspaceId,
          OR: [{ id }, { externalId: id }],
        },
        include: {
          adAccount: true,
          adSets: {
            include: { ads: true },
          },
        },
      })

      if (!campaign) {
        return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
      }

      let newExternalId = `camp_copy_${Date.now()}`

      // Chamar duplicação na Meta Marketing API
      if (campaign.adAccount?.accessTokenEnc) {
        try {
          const token = decrypt(campaign.adAccount.accessTokenEnc)
          const metaClient = new MetaApiClient(token)
          const res = await metaClient.duplicateCampaign(campaign.externalId, {
            deepCopy: true,
            status: 'PAUSED',
            suffix,
          })
          if (res?.id) newExternalId = res.id
          else if (res?.copied_parent_id) newExternalId = res.copied_parent_id
        } catch (metaErr) {
          console.error(`[Meta Duplicate] Falha ao duplicar na Meta Graph API:`, metaErr)
        }
      }

      // Duplicar no Prisma
      const newCampaign = await prisma.campaign.create({
        data: {
          workspaceId,
          adAccountId: campaign.adAccountId,
          externalId: newExternalId,
          name: `${campaign.name}${suffix}`,
          status: 'PAUSED',
          objective: campaign.objective,
          buyingType: campaign.buyingType,
          dailyBudget: campaign.dailyBudget,
          lifetimeBudget: campaign.lifetimeBudget,
          startTime: new Date(),
        },
      })

      // Duplicação profunda: conjuntos e anúncios
      for (const adSet of campaign.adSets) {
        const newAdSetExternalId = `adset_copy_${Date.now()}_${Math.random().toString(36).substring(7)}`
        const newAdSet = await prisma.adSet.create({
          data: {
            workspaceId,
            campaignId: newCampaign.id,
            externalId: newAdSetExternalId,
            name: `${adSet.name}${suffix}`,
            status: 'PAUSED',
            dailyBudget: adSet.dailyBudget,
            lifetimeBudget: adSet.lifetimeBudget,
            optimizationGoal: adSet.optimizationGoal,
            billingEvent: adSet.billingEvent,
            bidAmount: adSet.bidAmount,
          },
        })

        for (const ad of adSet.ads) {
          const newAdExternalId = `ad_copy_${Date.now()}_${Math.random().toString(36).substring(7)}`
          await prisma.ad.create({
            data: {
              workspaceId,
              adSetId: newAdSet.id,
              externalId: newAdExternalId,
              name: `${ad.name}${suffix}`,
              status: 'PAUSED',
              previewUrl: ad.previewUrl,
              creativeId: ad.creativeId,
            },
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Campanha duplicada com sucesso (criada como Pausada)',
        item: newCampaign,
      })
    }

    if (level === 'adset') {
      const adSet = await prisma.adSet.findFirst({
        where: {
          workspaceId,
          OR: [{ id }, { externalId: id }],
        },
        include: {
          campaign: {
            include: { adAccount: true },
          },
          ads: true,
        },
      })

      if (!adSet) {
        return NextResponse.json({ error: 'Conjunto de anúncios não encontrado' }, { status: 404 })
      }

      let newExternalId = `adset_copy_${Date.now()}`

      const tokenEnc = adSet.campaign?.adAccount?.accessTokenEnc
      if (tokenEnc) {
        try {
          const token = decrypt(tokenEnc)
          const metaClient = new MetaApiClient(token)
          const res = await metaClient.duplicateAdSet(adSet.externalId, {
            deepCopy: true,
            status: 'PAUSED',
            suffix,
          })
          if (res?.id) newExternalId = res.id
          else if (res?.copied_parent_id) newExternalId = res.copied_parent_id
        } catch (metaErr) {
          console.error(`[Meta Duplicate] Falha ao duplicar conjunto na Meta:`, metaErr)
        }
      }

      const newAdSet = await prisma.adSet.create({
        data: {
          workspaceId,
          campaignId: adSet.campaignId,
          externalId: newExternalId,
          name: `${adSet.name}${suffix}`,
          status: 'PAUSED',
          dailyBudget: adSet.dailyBudget,
          lifetimeBudget: adSet.lifetimeBudget,
          optimizationGoal: adSet.optimizationGoal,
          billingEvent: adSet.billingEvent,
          bidAmount: adSet.bidAmount,
        },
      })

      for (const ad of adSet.ads) {
        const newAdExternalId = `ad_copy_${Date.now()}_${Math.random().toString(36).substring(7)}`
        await prisma.ad.create({
          data: {
            workspaceId,
            adSetId: newAdSet.id,
            externalId: newAdExternalId,
            name: `${ad.name}${suffix}`,
            status: 'PAUSED',
            previewUrl: ad.previewUrl,
            creativeId: ad.creativeId,
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Conjunto de anúncios duplicado com sucesso',
        item: newAdSet,
      })
    }

    if (level === 'ad') {
      const ad = await prisma.ad.findFirst({
        where: {
          workspaceId,
          OR: [{ id }, { externalId: id }],
        },
        include: {
          adSet: {
            include: {
              campaign: {
                include: { adAccount: true },
              },
            },
          },
        },
      })

      if (!ad) {
        return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
      }

      let newExternalId = `ad_copy_${Date.now()}`

      const tokenEnc = ad.adSet?.campaign?.adAccount?.accessTokenEnc
      if (tokenEnc) {
        try {
          const token = decrypt(tokenEnc)
          const metaClient = new MetaApiClient(token)
          const res = await metaClient.duplicateAd(ad.externalId, {
            status: 'PAUSED',
            suffix,
          })
          if (res?.id) newExternalId = res.id
          else if (res?.copied_parent_id) newExternalId = res.copied_parent_id
        } catch (metaErr) {
          console.error(`[Meta Duplicate] Falha ao duplicar anúncio na Meta:`, metaErr)
        }
      }

      const newAd = await prisma.ad.create({
        data: {
          workspaceId,
          adSetId: ad.adSetId,
          externalId: newExternalId,
          name: `${ad.name}${suffix}`,
          status: 'PAUSED',
          previewUrl: ad.previewUrl,
          creativeId: ad.creativeId,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Criativo / Anúncio duplicado com sucesso',
        item: newAd,
      })
    }

    return NextResponse.json({ error: 'Nível inválido' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in /api/meta/duplicate:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao duplicar elemento na Meta' },
      { status: 500 }
    )
  }
}
