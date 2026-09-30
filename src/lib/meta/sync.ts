import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { MetaApiClient, MetaApiError } from './client'

export interface SyncResult {
  success: boolean
  campaigns: number
  adSets: number
  ads: number
  insights: number
  errors: string[]
  reconnectRequired?: boolean
}

function parseConversions(actions: any[] | undefined | null): { conversions: number; conversionValue: number } {
  if (!Array.isArray(actions)) return { conversions: 0, conversionValue: 0 }
  
  let conversions = 0
  let conversionValue = 0

  for (const action of actions) {
    const actionType = String(action.action_type || '').toLowerCase()
    // Standard Meta conversion action types
    if (
      actionType === 'purchase' ||
      actionType === 'omni_purchase' ||
      actionType === 'offsite_conversion.fb_pixel_purchase' ||
      actionType === 'lead' ||
      actionType === 'offsite_conversion.fb_pixel_lead' ||
      actionType.includes('purchase')
    ) {
      conversions += parseInt(action.value, 10) || 1
    }
  }

  return { conversions, conversionValue }
}

export async function syncAdAccount(workspaceId: string, adAccountDbId: string): Promise<SyncResult> {
  let syncLogId: string | null = null

  try {
    const account = await prisma.adAccount.findFirst({
      where: { id: adAccountDbId, workspaceId }
    })

    if (!account) {
      return { success: false, campaigns: 0, adSets: 0, ads: 0, insights: 0, errors: ['Conta de anúncios não encontrada no workspace'] }
    }
    if (!account.accessTokenEnc) {
      return { success: false, campaigns: 0, adSets: 0, ads: 0, insights: 0, errors: ['Nenhum token configurado para esta conta'] }
    }

    let token: string
    try {
      token = decrypt(account.accessTokenEnc)
    } catch {
      await prisma.adAccount.update({
        where: { id: account.id },
        data: { status: 'reconnect_required' }
      })
      return { success: false, campaigns: 0, adSets: 0, ads: 0, insights: 0, errors: ['Token corrompido. Reconexão necessária.'], reconnectRequired: true }
    }

    const client = new MetaApiClient(token)

    const syncLog = await prisma.syncLog.create({
      data: {
        workspaceId,
        adAccountId: account.id,
        status: 'running',
        type: 'meta_ads'
      }
    })
    syncLogId = syncLog.id

    // 1. Sincronizar Campanhas
    const campaigns = await client.getCampaigns(account.externalId)
    let totalAdSets = 0
    let totalAds = 0
    let totalInsights = 0

    const campaignDbMap = new Map<string, string>() // externalId -> dbId

    for (const c of campaigns) {
      const dbCampaign = await prisma.campaign.upsert({
        where: {
          adAccountId_externalId: {
            adAccountId: account.id,
            externalId: c.id
          }
        },
        update: {
          name: c.name,
          status: c.status || 'ACTIVE',
          objective: c.objective || null,
          buyingType: c.buying_type || null,
          dailyBudget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
          lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
          startTime: c.start_time ? new Date(c.start_time) : null,
          stopTime: c.stop_time ? new Date(c.stop_time) : null,
          lastSyncAt: new Date()
        },
        create: {
          workspaceId,
          adAccountId: account.id,
          externalId: c.id,
          name: c.name,
          status: c.status || 'ACTIVE',
          objective: c.objective || null,
          buyingType: c.buying_type || null,
          dailyBudget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
          lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
          startTime: c.start_time ? new Date(c.start_time) : null,
          stopTime: c.stop_time ? new Date(c.stop_time) : null,
          lastSyncAt: new Date()
        }
      })

      campaignDbMap.set(c.id, dbCampaign.id)

      // 2. Sincronizar Conjuntos de Anúncios (AdSets)
      try {
        const adSets = await client.getAdSets(c.id)
        totalAdSets += adSets.length
        
        for (const as of adSets) {
          const dbAdSet = await prisma.adSet.upsert({
            where: {
              campaignId_externalId: {
                campaignId: dbCampaign.id,
                externalId: as.id
              }
            },
            update: {
              name: as.name,
              status: as.status || 'ACTIVE',
              dailyBudget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
              lifetimeBudget: as.lifetime_budget ? parseFloat(as.lifetime_budget) / 100 : null,
              optimizationGoal: as.optimization_goal || null,
              billingEvent: as.billing_event || null,
              bidAmount: as.bid_amount ? parseFloat(as.bid_amount) / 100 : null,
              startTime: as.start_time ? new Date(as.start_time) : null,
              endTime: as.end_time ? new Date(as.end_time) : null,
              lastSyncAt: new Date()
            },
            create: {
              workspaceId,
              campaignId: dbCampaign.id,
              externalId: as.id,
              name: as.name,
              status: as.status || 'ACTIVE',
              dailyBudget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
              lifetimeBudget: as.lifetime_budget ? parseFloat(as.lifetime_budget) / 100 : null,
              optimizationGoal: as.optimization_goal || null,
              billingEvent: as.billing_event || null,
              bidAmount: as.bid_amount ? parseFloat(as.bid_amount) / 100 : null,
              startTime: as.start_time ? new Date(as.start_time) : null,
              endTime: as.end_time ? new Date(as.end_time) : null,
              lastSyncAt: new Date()
            }
          })

          // 3. Sincronizar Anúncios (Ads)
          try {
            const ads = await client.getAds(as.id)
            totalAds += ads.length

            for (const ad of ads) {
              await prisma.ad.upsert({
                where: {
                  adSetId_externalId: {
                    adSetId: dbAdSet.id,
                    externalId: ad.id
                  }
                },
                update: {
                  name: ad.name,
                  status: ad.status || 'ACTIVE',
                  creativeId: ad.creative?.id || null,
                  previewUrl: ad.creative?.image_url || ad.creative?.thumbnail_url || null,
                  lastSyncAt: new Date()
                },
                create: {
                  workspaceId,
                  adSetId: dbAdSet.id,
                  externalId: ad.id,
                  name: ad.name,
                  status: ad.status || 'ACTIVE',
                  creativeId: ad.creative?.id || null,
                  previewUrl: ad.creative?.image_url || ad.creative?.thumbnail_url || null,
                  lastSyncAt: new Date()
                }
              })
            }
          } catch (adErr) {
            console.warn(`[Sync] Aviso ao sincronizar anúncios do AdSet ${as.id}:`, adErr)
          }
        }
      } catch (adSetErr) {
        console.warn(`[Sync] Aviso ao sincronizar AdSets da campanha ${c.id}:`, adSetErr)
      }
    }

    // 4. Sincronizar Métricas e Insights Reais (Últimos 30 dias com quebra diária)
    try {
      const insights = await client.getInsights(account.externalId, 'campaign', 'last_30d')
      
      for (const ins of insights) {
        const campaignDbId = campaignDbMap.get(ins.campaign_id)
        if (!campaignDbId) continue

        const dateStart = new Date(ins.date_start)
        const dateStop = new Date(ins.date_stop)
        const spend = parseFloat(ins.spend) || 0
        const impressions = parseInt(ins.impressions, 10) || 0
        const reach = parseInt(ins.reach, 10) || 0
        const clicks = parseInt(ins.clicks, 10) || 0
        const uniqueClicks = parseInt(ins.unique_clicks, 10) || clicks
        const ctr = parseFloat(ins.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0)
        const cpc = parseFloat(ins.cpc) || (clicks > 0 ? spend / clicks : 0)
        const cpm = parseFloat(ins.cpm) || (impressions > 0 ? (spend / impressions) * 1000 : 0)
        const frequency = parseFloat(ins.frequency) || (reach > 0 ? impressions / reach : 1)

        const { conversions, conversionValue } = parseConversions(ins.actions)

        await prisma.campaignInsight.upsert({
          where: {
            campaignId_dateStart_dateStop: {
              campaignId: campaignDbId,
              dateStart,
              dateStop
            }
          },
          update: {
            spend,
            impressions,
            reach,
            clicks,
            uniqueClicks,
            ctr,
            cpc,
            cpm,
            frequency,
            conversions,
            conversionValue,
            actions: ins.actions ? JSON.stringify(ins.actions) : null
          },
          create: {
            campaignId: campaignDbId,
            dateStart,
            dateStop,
            spend,
            impressions,
            reach,
            clicks,
            uniqueClicks,
            ctr,
            cpc,
            cpm,
            frequency,
            conversions,
            conversionValue,
            actions: ins.actions ? JSON.stringify(ins.actions) : null
          }
        })

        totalInsights++
      }
    } catch (insightErr) {
      console.warn(`[Sync] Aviso ao buscar insights da conta ${account.externalId}:`, insightErr)
    }

    // 5. Atualizar status da conta e data do último sync
    await prisma.adAccount.update({
      where: { id: account.id },
      data: { 
        lastSyncAt: new Date(),
        status: 'active'
      }
    })

    if (syncLogId) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'success',
          finishedAt: new Date(),
          itemsTotal: campaigns.length + totalAdSets + totalAds + totalInsights,
          itemsProcessed: campaigns.length + totalAdSets + totalAds + totalInsights
        }
      })
    }

    return {
      success: true,
      campaigns: campaigns.length,
      adSets: totalAdSets,
      ads: totalAds,
      insights: totalInsights,
      errors: []
    }
  } catch (error: unknown) {
    console.error('Meta sync error:', error)
    const isTokenInvalid = error instanceof MetaApiError && error.isTokenInvalid
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido na sincronização'

    if (isTokenInvalid) {
      await prisma.adAccount.update({
        where: { id: adAccountDbId },
        data: { status: 'reconnect_required' }
      }).catch(() => {})
    }

    if (syncLogId) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'failed',
          errorMessage: errorMsg,
          finishedAt: new Date()
        }
      }).catch(() => {})
    }

    return {
      success: false,
      campaigns: 0,
      adSets: 0,
      ads: 0,
      insights: 0,
      errors: [errorMsg],
      reconnectRequired: isTokenInvalid
    }
  }
}

export async function syncInsightsOnly(
  workspaceId: string,
  adAccountDbId: string,
  since?: string,
  until?: string
) {
  try {
    const account = await prisma.adAccount.findFirst({
      where: { id: adAccountDbId, workspaceId }
    })
    if (!account || !account.accessTokenEnc) {
      return { success: false, error: 'Conta ou token não encontrado' }
    }
    
    const token = decrypt(account.accessTokenEnc)
    const client = new MetaApiClient(token)
    const insights = await client.getInsights(account.externalId, 'campaign', 'last_30d', since, until)

    return { success: true, count: insights.length }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao sincronizar insights'
    return { success: false, error: msg }
  }
}

