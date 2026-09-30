import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { v4 as uuid } from 'uuid'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ endpoints })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await req.json()
  const endpointId = uuid().replace(/-/g, '').slice(0, 16)
  const secret = uuid().replace(/-/g, '')

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      workspaceId,
      name: body.name || 'Webhook Genérico',
      endpointId,
      secret,
      fieldMapping: body.fieldMapping ? JSON.stringify(body.fieldMapping) : null,
      isActive: true
    }
  })

  return NextResponse.json({ endpoint })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  await prisma.webhookEndpoint.delete({
    where: { id }
  })

  return NextResponse.json({ success: true })
}
