import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserWorkspaceId } from '@/lib/workspace'
import { getAutoSyncStatus, triggerBackgroundMetaSyncIfNeeded } from '@/lib/meta/auto-sync'

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
    const trigger = searchParams.get('trigger') === 'true'

    if (trigger) {
      await triggerBackgroundMetaSyncIfNeeded(workspaceId, 15)
    }

    const status = await getAutoSyncStatus(workspaceId, 15)
    return NextResponse.json(status)
  } catch (error) {
    console.error('Error getting auto-sync status:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Dispara forçado considerando stale de 0 minutos (força atualização de todas ativas)
    const result = await triggerBackgroundMetaSyncIfNeeded(workspaceId, 0)
    const status = await getAutoSyncStatus(workspaceId, 15)

    return NextResponse.json({
      success: true,
      result,
      status,
    })
  } catch (error) {
    console.error('Error triggering auto-sync:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
