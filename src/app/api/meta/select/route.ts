import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'

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

    const body = await req.json()
    const { selectedAccountIds } = body

    if (!Array.isArray(selectedAccountIds)) {
      return NextResponse.json(
        { error: 'Formato inválido: selectedAccountIds deve ser um array de IDs' },
        { status: 400 }
      )
    }

    // 1. Activate selected accounts
    if (selectedAccountIds.length > 0) {
      await prisma.adAccount.updateMany({
        where: {
          workspaceId,
          id: { in: selectedAccountIds },
        },
        data: { status: 'active' },
      })
    }

    // 2. Deactivate all other accounts in this workspace
    await prisma.adAccount.updateMany({
      where: {
        workspaceId,
        id: { notIn: selectedAccountIds },
      },
      data: { status: 'inactive' },
    })

    return NextResponse.json({
      success: true,
      activatedCount: selectedAccountIds.length,
    })
  } catch (error: unknown) {
    console.error('[Meta Select] Error selecting ad accounts:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
