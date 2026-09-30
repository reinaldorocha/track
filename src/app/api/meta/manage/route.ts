import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { decrypt } from '@/lib/encryption'
import { MetaApiClient } from '@/lib/meta/client'

export async function PATCH(req: Request) {
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
      ids, // Para ações em massa
      status, // 'ACTIVE' | 'PAUSED'
      name,
      budget, // em R$ (ex: 150.00)
      budgetChangePercent, // Para escala percentual em massa (ex: +20 ou -20)
    } = body

    if (!level || (!id && (!ids || !ids.length))) {
      return NextResponse.json({ error: 'Parâmetros inválidos. Informe level e id(s)' }, { status: 400 })
    }

    const targetIds: string[] = ids && Array.isArray(ids) && ids.length > 0 ? ids : [id]
    const updatedItems: any[] = []

    for (const targetId of targetIds) {
      if (level === 'campaign') {
        const campaign = await prisma.campaign.findFirst({
          where: {
            workspaceId,
            OR: [{ id: targetId }, { externalId: targetId }],
          },
          include: { adAccount: true },
        })

        if (!campaign) continue

        let newBudget = campaign.dailyBudget
        if (budget !== undefined) {
          newBudget = Number(budget)
        } else if (budgetChangePercent !== undefined && campaign.dailyBudget) {
          newBudget = Math.max(1, Math.round(campaign.dailyBudget * (1 + Number(budgetChangePercent) / 100)))
        }

        const updateData: any = { updatedAt: new Date() }
        if (status) updateData.status = status.toUpperCase()
        if (name) updateData.name = name
        if (newBudget !== undefined) updateData.dailyBudget = newBudget

        // Atualizar banco local
        const updated = await prisma.campaign.update({
          where: { id: campaign.id },
          data: updateData,
        })

        // Atualizar na Meta Marketing API
        if (campaign.adAccount?.accessTokenEnc) {
          try {
            const token = decrypt(campaign.adAccount.accessTokenEnc)
            const metaClient = new MetaApiClient(token)
            const metaPayload: any = {}
            if (status) metaPayload.status = status.toUpperCase()
            if (name) metaPayload.name = name
            if (newBudget !== undefined && newBudget !== null) {
              metaPayload.daily_budget = Math.round(newBudget * 100) // Meta espera em centavos
            }
            if (Object.keys(metaPayload).length > 0) {
              await metaClient.updateCampaign(campaign.externalId, metaPayload)
            }
          } catch (metaErr) {
            console.error(`[Meta Manage] Falha ao atualizar campanha ${campaign.externalId} na Meta:`, metaErr)
          }
        }

        updatedItems.push(updated)
      } else if (level === 'adset') {
        const adSet = await prisma.adSet.findFirst({
          where: {
            workspaceId,
            OR: [{ id: targetId }, { externalId: targetId }],
          },
          include: {
            campaign: {
              include: { adAccount: true },
            },
          },
        })

        if (!adSet) continue

        let newBudget = adSet.dailyBudget
        if (budget !== undefined) {
          newBudget = Number(budget)
        } else if (budgetChangePercent !== undefined && adSet.dailyBudget) {
          newBudget = Math.max(1, Math.round(adSet.dailyBudget * (1 + Number(budgetChangePercent) / 100)))
        }

        const updateData: any = { updatedAt: new Date() }
        if (status) updateData.status = status.toUpperCase()
        if (name) updateData.name = name
        if (newBudget !== undefined) updateData.dailyBudget = newBudget

        // Atualizar banco local
        const updated = await prisma.adSet.update({
          where: { id: adSet.id },
          data: updateData,
        })

        // Atualizar na Meta Marketing API
        const tokenEnc = adSet.campaign?.adAccount?.accessTokenEnc
        if (tokenEnc) {
          try {
            const token = decrypt(tokenEnc)
            const metaClient = new MetaApiClient(token)
            const metaPayload: any = {}
            if (status) metaPayload.status = status.toUpperCase()
            if (name) metaPayload.name = name
            if (newBudget !== undefined && newBudget !== null) {
              metaPayload.daily_budget = Math.round(newBudget * 100) // Centavos
            }
            if (Object.keys(metaPayload).length > 0) {
              await metaClient.updateAdSet(adSet.externalId, metaPayload)
            }
          } catch (metaErr) {
            console.error(`[Meta Manage] Falha ao atualizar conjunto ${adSet.externalId} na Meta:`, metaErr)
          }
        }

        updatedItems.push(updated)
      } else if (level === 'ad') {
        const ad = await prisma.ad.findFirst({
          where: {
            workspaceId,
            OR: [{ id: targetId }, { externalId: targetId }],
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

        if (!ad) continue

        const updateData: any = { updatedAt: new Date() }
        if (status) updateData.status = status.toUpperCase()
        if (name) updateData.name = name

        // Atualizar banco local
        const updated = await prisma.ad.update({
          where: { id: ad.id },
          data: updateData,
        })

        // Atualizar na Meta Marketing API
        const tokenEnc = ad.adSet?.campaign?.adAccount?.accessTokenEnc
        if (tokenEnc) {
          try {
            const token = decrypt(tokenEnc)
            const metaClient = new MetaApiClient(token)
            const metaPayload: any = {}
            if (status) metaPayload.status = status.toUpperCase()
            if (name) metaPayload.name = name
            if (Object.keys(metaPayload).length > 0) {
              await metaClient.updateAd(ad.externalId, metaPayload)
            }
          } catch (metaErr) {
            console.error(`[Meta Manage] Falha ao atualizar anúncio ${ad.externalId} na Meta:`, metaErr)
          }
        }

        updatedItems.push(updated)
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedItems.length,
      items: updatedItems,
    })
  } catch (error: any) {
    console.error('Error in /api/meta/manage:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar entidade Meta' },
      { status: 500 }
    )
  }
}
