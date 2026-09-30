import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendPixelEvents, PixelEvent } from '@/lib/meta/pixel'
import { sha256Hash, decrypt } from '@/lib/encryption'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const body = await req.json()
    const { 
      pixelId, 
      eventName, 
      eventId, 
      value, 
      currency, 
      orderId, 
      sourceUrl, 
      userEmail, 
      userPhone, 
      fbp, 
      fbc, 
      ipAddress, 
      userAgent 
    } = body

    const pixel = await prisma.pixel.findFirst({
      where: { id: pixelId, workspaceId }
    })

    if (!pixel) {
      return NextResponse.json({ error: 'Pixel not found' }, { status: 404 })
    }

    if (!pixel.accessTokenEnc) {
      return NextResponse.json({ error: 'Pixel access token not configured' }, { status: 400 })
    }

    const accessToken = decrypt(pixel.accessTokenEnc)

    const userData: PixelEvent['user_data'] = {
      client_ip_address: ipAddress || '127.0.0.1',
      client_user_agent: userAgent || 'Mozilla/5.0',
      fbp: fbp || undefined,
      fbc: fbc || undefined
    }

    if (userEmail) userData.em = [sha256Hash(userEmail.toLowerCase().trim())]
    if (userPhone) userData.ph = [sha256Hash(userPhone.replace(/\D/g, ''))]

    const customData: PixelEvent['custom_data'] = {}
    if (value) customData.value = parseFloat(value)
    if (currency) customData.currency = currency
    if (orderId) customData.order_id = orderId

    const eventData: PixelEvent = {
      event_name: eventName || 'PageView',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId || undefined,
      event_source_url: sourceUrl || undefined,
      action_source: 'website',
      user_data: userData,
      custom_data: Object.keys(customData).length > 0 ? customData : undefined
    }

    const result = await sendPixelEvents(pixel.pixelId, accessToken, [eventData], pixel.testEventCode || undefined)
    
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Meta pixel event error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
