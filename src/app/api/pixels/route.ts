import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt, maskSecret } from '@/lib/encryption'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const pixels = await prisma.pixel.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ 
    pixels: pixels.map((p) => ({
      ...p,
      accessTokenEnc: p.accessTokenEnc ? maskSecret(p.accessTokenEnc) : null
    }))
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await req.json()
  const { name, pixelId, accessToken, environment, testEventCode } = body

  if (!name || !pixelId) {
    return NextResponse.json({ error: 'Nome e Pixel ID são obrigatórios' }, { status: 400 })
  }

  const pixel = await prisma.pixel.upsert({
    where: {
      workspaceId_pixelId: {
        workspaceId,
        pixelId
      }
    },
    update: {
      name,
      accessTokenEnc: accessToken ? encrypt(accessToken) : undefined,
      environment: environment || 'production',
      testEventCode: testEventCode || null,
      status: 'active'
    },
    create: {
      workspaceId,
      name,
      pixelId,
      accessTokenEnc: accessToken ? encrypt(accessToken) : null,
      environment: environment || 'production',
      testEventCode: testEventCode || null,
      status: 'active'
    }
  })

  return NextResponse.json({ pixel }, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await req.json()
  const { id, name, status, testEventCode, accessToken, environment } = body

  if (!id) return NextResponse.json({ error: 'Missing Pixel ID' }, { status: 400 })

  const updateData: any = {}
  if (name !== undefined) updateData.name = name
  if (status !== undefined) updateData.status = status
  if (testEventCode !== undefined) updateData.testEventCode = testEventCode
  if (environment !== undefined) updateData.environment = environment
  if (accessToken) updateData.accessTokenEnc = encrypt(accessToken)

  const pixel = await prisma.pixel.update({
    where: { id, workspaceId },
    data: updateData
  })

  return NextResponse.json({ success: true, pixel })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  await prisma.pixel.delete({
    where: { id, workspaceId }
  })

  return NextResponse.json({ success: true })
}
