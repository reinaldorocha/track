import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { encrypt } from '@/lib/encryption'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const accounts = await prisma.adAccount.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        externalId: true,
        status: true,
        currency: true,
        timezone: true,
        lastSyncAt: true,
        createdAt: true
      }
    })

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Error fetching ad accounts:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const body = await req.json()
    const { name, externalId, accessToken } = body

    if (!name || !externalId) {
      return NextResponse.json({ error: 'Nome e ID da conta são obrigatórios' }, { status: 400 })
    }

    const cleanExternalId = externalId.startsWith('act_') ? externalId : `act_${externalId}`
    const accessTokenEnc = accessToken ? encrypt(accessToken) : null

    const account = await prisma.adAccount.upsert({
      where: {
        workspaceId_externalId: {
          workspaceId,
          externalId: cleanExternalId
        }
      },
      update: {
        name,
        status: 'active',
        ...(accessTokenEnc ? { accessTokenEnc } : {})
      },
      create: {
        workspaceId,
        externalId: cleanExternalId,
        name,
        status: 'active',
        accessTokenEnc
      }
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    console.error('Error adding ad account:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await prisma.adAccount.delete({
      where: { id, workspaceId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting ad account:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
