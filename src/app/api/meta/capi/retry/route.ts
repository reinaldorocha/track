import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserWorkspaceId } from '@/lib/workspace'
import { retryFailedCapiEvents } from '@/lib/meta/capi-service'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    let workspaceId: string | undefined

    // Se tiver cron secret configurado e header corresponder
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Cron global reprocessa todos os workspaces
    } else {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      workspaceId = (await getUserWorkspaceId(session.user.id)) || undefined
      if (!workspaceId) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      }
    }

    const result = await retryFailedCapiEvents(workspaceId, 25)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[API CAPI Retry] Erro:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
