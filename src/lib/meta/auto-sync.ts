import { prisma } from '@/lib/db'
import { syncAdAccount } from './sync'

export interface AutoSyncStatus {
  enabled: boolean
  intervalMinutes: number
  lastSyncAt: string | null
  nextSyncInMinutes: number
  isSyncing: boolean
  totalAccounts: number
  activeAccounts: number
  activeAccountNames: string[]
}

/**
 * Verifica o status da sincronizaÃ§Ã£o automÃ¡tica em background das contas Meta Ads.
 */
export async function getAutoSyncStatus(
  workspaceId: string,
  maxAgeMinutes = 15
): Promise<AutoSyncStatus> {
  const accounts = await prisma.adAccount.findMany({
    where: { workspaceId },
    select: { id: true, name: true, status: true, lastSyncAt: true },
  })

  const activeAccounts = accounts.filter((a) => a.status === 'active')
  const totalAccounts = accounts.length
  const activeCount = activeAccounts.length

  // Localizar o Ãºltimo sync dentre as contas ativas
  let latestSync: Date | null = null
  for (const acc of activeAccounts) {
    if (acc.lastSyncAt) {
      if (!latestSync || acc.lastSyncAt.getTime() > latestSync.getTime()) {
        latestSync = acc.lastSyncAt
      }
    }
  }

  // Verificar se hÃ¡ sync em execuÃ§Ã£o nos Ãºltimos 5 minutos
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const runningLog = await prisma.syncLog.findFirst({
    where: {
      workspaceId,
      status: 'running',
      type: 'meta_ads',
      startedAt: { gte: fiveMinutesAgo },
    },
  })

  const isSyncing = Boolean(runningLog)

  let nextSyncInMinutes = 0
  if (latestSync) {
    const elapsedMinutes = (Date.now() - latestSync.getTime()) / (60 * 1000)
    nextSyncInMinutes = Math.max(0, Math.ceil(maxAgeMinutes - elapsedMinutes))
  }

  return {
    enabled: activeCount > 0,
    intervalMinutes: maxAgeMinutes,
    lastSyncAt: latestSync ? latestSync.toISOString() : null,
    nextSyncInMinutes,
    isSyncing,
    totalAccounts,
    activeAccounts: activeCount,
    activeAccountNames: activeAccounts.map((a) => a.name),
  }
}

/**
 * Dispara de forma assÃ­ncrona (nÃ£o-bloqueante) a sincronizaÃ§Ã£o das contas Meta Ads ativas
 * caso tenham dados mais antigos que `maxAgeMinutes` (padrÃ£o: 15 minutos).
 */
export async function triggerBackgroundMetaSyncIfNeeded(
  workspaceId: string,
  maxAgeMinutes = 15
): Promise<{ triggered: boolean; reason?: string; accountIds?: string[] }> {
  try {
    const activeAccounts = await prisma.adAccount.findMany({
      where: { workspaceId, status: 'active' },
      select: { id: true, name: true, lastSyncAt: true, accessTokenEnc: true },
    })

    if (activeAccounts.length === 0) {
      return { triggered: false, reason: 'no_active_accounts' }
    }

    // Verificar se jÃ¡ existe um sync em andamento
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const runningLog = await prisma.syncLog.findFirst({
      where: {
        workspaceId,
        status: 'running',
        type: 'meta_ads',
        startedAt: { gte: fiveMinutesAgo },
      },
    })

    if (runningLog) {
      return { triggered: false, reason: 'sync_already_running' }
    }

    const thresholdTime = Date.now() - maxAgeMinutes * 60 * 1000
    const staleAccounts = activeAccounts.filter(
      (a) => !a.lastSyncAt || a.lastSyncAt.getTime() < thresholdTime
    )

    if (staleAccounts.length === 0) {
      return { triggered: false, reason: 'up_to_date' }
    }

    const accountIdsToSync = staleAccounts.map((a) => a.id)

    // Disparar sincronizaÃ§Ã£o assÃ­ncrona em background (fire and forget)
    // NÃ£o bloqueia a requisiÃ§Ã£o HTTP atual
    Promise.resolve().then(async () => {
      console.log(`[Auto-Sync Meta Ads] Iniciando sync em background para ${staleAccounts.length} conta(s)...`)
      for (const acc of staleAccounts) {
        try {
          await syncAdAccount(workspaceId, acc.id)
          console.log(`[Auto-Sync Meta Ads] SincronizaÃ§Ã£o da conta '${acc.name}' concluÃ­da com sucesso.`)
        } catch (err) {
          console.error(`[Auto-Sync Meta Ads] Erro ao sincronizar conta '${acc.name}':`, err)
        }
      }
    }).catch((e) => {
      console.error('[Auto-Sync Meta Ads] Erro inesperado na Promise em background:', e)
    })

    return {
      triggered: true,
      accountIds: accountIdsToSync,
    }
  } catch (error) {
    console.error('[Auto-Sync Meta Ads] Falha ao verificar contas para auto-sync:', error)
    return { triggered: false, reason: 'internal_error' }
  }
}

