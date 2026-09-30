const CAPI_URL = 'https://graph.facebook.com/v21.0'

export interface PixelEvent {
  event_name: string
  event_time: number
  event_id?: string
  event_source_url?: string
  action_source: 'website' | 'app' | 'email' | 'phone_call' | 'system_generated'
  user_data: {
    em?: string[] // hashed email
    ph?: string[] // hashed phone
    client_ip_address?: string
    client_user_agent?: string
    fbp?: string
    fbc?: string
  }
  custom_data?: {
    value?: number
    currency?: string
    order_id?: string
    content_ids?: string[]
    content_type?: string
  }
}

export async function sendPixelEvents(pixelId: string, accessToken: string, events: PixelEvent[], testEventCode?: string) {
  const body: Record<string, unknown> = { data: events }
  if (testEventCode) body.test_event_code = testEventCode
  
  const response = await fetch(`${CAPI_URL}/${pixelId}/events?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  
  const result = await response.json()
  return result
}
