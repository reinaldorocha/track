import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const links = await prisma.utmLink.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ links })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(session.user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await req.json()

  let fullUrl = body.url || body.destinationUrl
  if (!fullUrl) return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 })

  if (!fullUrl.startsWith('http')) fullUrl = 'https://' + fullUrl
  
  const urlObj = new URL(fullUrl)
  if (body.utm_source) urlObj.searchParams.set('utm_source', body.utm_source)
  if (body.utm_medium) urlObj.searchParams.set('utm_medium', body.utm_medium)
  if (body.utm_campaign) urlObj.searchParams.set('utm_campaign', body.utm_campaign)
  if (body.utm_content) urlObj.searchParams.set('utm_content', body.utm_content)
  if (body.utm_term) urlObj.searchParams.set('utm_term', body.utm_term)

  const finalUrl = urlObj.toString()

  const link = await prisma.utmLink.create({
    data: {
      workspaceId,
      name: body.name || body.utm_campaign || 'Link UTM',
      destinationUrl: body.url || body.destinationUrl,
      fullUrl: finalUrl,
      utmSource: body.utm_source,
      utmMedium: body.utm_medium,
      utmCampaign: body.utm_campaign,
      utmContent: body.utm_content,
      utmTerm: body.utm_term,
      adAccountId: body.adAccountId,
      campaignId: body.campaignId,
      adSetId: body.adSetId,
      adId: body.adId,
    }
  })

  return NextResponse.json({ link })
}

export async function PATCH(req: Request) {
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  await prisma.utmLink.delete({
    where: { id }
  })

  return NextResponse.json({ success: true })
}
