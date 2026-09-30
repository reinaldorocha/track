import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const notifications = await prisma.notification.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    const unreadCount = await prisma.notification.count({
      where: { workspaceId, isRead: false }
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const body = await req.json()
    const { id, all } = body

    if (all) {
      await prisma.notification.updateMany({
        where: { workspaceId, isRead: false },
        data: { isRead: true, readAt: new Date() }
      })
    } else if (id) {
      await prisma.notification.update({
        where: { id, workspaceId },
        data: { isRead: true, readAt: new Date() }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (id) {
      await prisma.notification.delete({
        where: { id, workspaceId }
      })
    } else {
      await prisma.notification.deleteMany({
        where: { workspaceId }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
