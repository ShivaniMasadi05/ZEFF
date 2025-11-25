import { NextRequest, NextResponse } from 'next/server'

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper function to create a fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}

// POST /api/reportee - Fetch reportee tickets from webhook
export async function POST(request: NextRequest) {
  try {
    // Get logged-in user from session
    const cookiesHeader = request.headers.get('cookie') || ''
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : cookiesHeader

    // Get logged-in user from Frappe with timeout
    let userResponse: Response
    try {
      userResponse = await fetchWithTimeout(
        'https://zeff.valuepitch.ai/api/method/frappe.auth.get_logged_user',
        {
          method: 'GET',
          headers: {
            'Cookie': forwardCookie,
          },
        },
        10000 // 10 second timeout for auth
      )
    } catch (error) {
      console.error('[Reportee API] Auth fetch failed or timed out:', error)
      return NextResponse.json(
        { error: 'Authentication request timed out', tickets: [] },
        { status: 504 }
      )
    }

    if (!userResponse.ok) {
      return NextResponse.json({ error: 'Authentication required', tickets: [] }, { status: 401 })
    }

    const userData = await userResponse.json()
    let email = userData?.message || userData?.data?.message || null

    if (!email) {
      // Fallback to request body if session doesn't have user
      const body = await request.json().catch(() => ({}))
      const bodyEmail = body.email
      if (!bodyEmail) {
        return NextResponse.json({ error: 'User email not found in session or request', tickets: [] }, { status: 400 })
      }
      email = bodyEmail
    }

    console.log('[Reportee API] Fetching reportee tickets for logged-in user:', email)

    // Call the webhook endpoint with timeout
    const formData = new FormData()
    formData.append('email', email)

    let response: Response
    try {
      response = await fetchWithTimeout(
        'https://automation.lendingcube.ai/webhook/reportee',
        {
          method: 'POST',
          body: formData,
          cache: 'no-store'
        },
        15000 // 15 second timeout for webhook
      )
    } catch (error) {
      console.error('[Reportee API] Webhook fetch failed or timed out:', error)
      // Return empty array instead of error to prevent UI breaking
      return NextResponse.json(
        { tickets: [] },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      )
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('[Reportee API] Webhook error:', response.status, errorText)
      // Return empty array instead of error to prevent UI breaking
      return NextResponse.json(
        { tickets: [] },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      )
    }

    const data = await response.json()

    // Handle both array response and wrapped response
    let reporteeTickets = []
    if (Array.isArray(data)) {
      reporteeTickets = data
    } else if (Array.isArray(data.data)) {
      reporteeTickets = data.data
    } else if (Array.isArray(data.tickets)) {
      reporteeTickets = data.tickets
    }

    console.log('[Reportee API] Returning', reporteeTickets.length, 'reportee tickets')

    return NextResponse.json(
      { tickets: reporteeTickets },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    )
  } catch (error) {
    console.error('[Reportee API] Error fetching reportee tickets:', error)
    // Return empty array instead of error to prevent UI breaking and 502 errors
    return NextResponse.json(
      { tickets: [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    )
  }
}

