import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { syncAdAccount } from '@/lib/meta/sync'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    let body: { accountId?: string } = {}
    try {
      body = await req.json()
    } catch {}

    const accountId = body.accountId

    // Sync a single account if specified
    if (accountId) {
      const result = await syncAdAccount(workspaceId, accountId)
      return NextResponse.json(result)
    }

    // Sync only active accounts — never all 19 if most are inactive
    const accounts = await prisma.adAccount.findMany({
      where: { workspaceId, status: 'active' },
    })

    if (accounts.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhuma conta ativa para sincronizar', synced: 0 })
    }

    const results = []
    for (const acc of accounts) {
      // Each account syncs independently — an error in one does not stop the others
      try {
        const res = await syncAdAccount(workspaceId, acc.id)
        results.push({ accountId: acc.id, name: acc.name, ...res })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error(`[Meta Sync] Erro na conta ${acc.id}:`, err)
        results.push({ accountId: acc.id, name: acc.name, success: false, errors: [msg] })
      }
    }

    const successCount = results.filter((r) => r.success).length
    return NextResponse.json({
      success: true,
      synced: accounts.length,
      succeeded: successCount,
      failed: accounts.length - successCount,
      results,
    })
  } catch (error) {
    console.error('[Meta Sync] Erro geral:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
