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

export interface CapiSendResult {
  ok: boolean
  status: number
  events_received?: number
  fbtrace_id?: string
  messages?: string[]
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export async function sendPixelEvents(
  pixelId: string,
  accessToken: string,
  events: PixelEvent[],
  testEventCode?: string
): Promise<CapiSendResult> {
  const body: Record<string, unknown> = { data: events }
  if (testEventCode) body.test_event_code = testEventCode
  
  try {
    const response = await fetch(`${CAPI_URL}/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    
    let result: Record<string, unknown> = {}
    try {
      result = await response.json()
    } catch {
      result = { error: { message: `Non-JSON response from Meta (HTTP ${response.status})` } }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: (result.error as CapiSendResult['error']) || { message: `Meta API returned HTTP ${response.status}` },
        events_received: 0,
        ...result
      }
    }

    return {
      ok: true,
      status: response.status,
      events_received: typeof result.events_received === 'number' ? result.events_received : events.length,
      ...result
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: { message: err instanceof Error ? err.message : 'Network error sending CAPI events' },
      events_received: 0
    }
  }
}
