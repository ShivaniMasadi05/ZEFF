import { NextRequest, NextResponse } from 'next/server'

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/reportee - Fetch reportee tickets from webhook
export async function POST(request: NextRequest) {
  try {
    // Get logged-in user from session
    const cookiesHeader = request.headers.get('cookie') || ''
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : cookiesHeader

    // Get logged-in user from Frappe
    const userResponse = await fetch('https://zeff.valuepitch.ai/api/method/frappe.auth.get_logged_user', {
      method: 'GET',
      headers: {
        'Cookie': forwardCookie,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userData = await userResponse.json()
    let email = userData?.message || userData?.data?.message || null

    if (!email) {
      // Fallback to request body if session doesn't have user
      const body = await request.json().catch(() => ({}))
      const bodyEmail = body.email
      if (!bodyEmail) {
        return NextResponse.json({ error: 'User email not found in session or request' }, { status: 400 })
      }
      email = bodyEmail
    }

    console.log('[Reportee API] Fetching reportee tickets for logged-in user:', email)

    // Call the webhook endpoint
    const formData = new FormData()
    formData.append('email', email)

    const response = await fetch('https://automation.lendingcube.ai/webhook/reportee', {
      method: 'POST',
      body: formData,
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('[Reportee API] Webhook error:', response.status, errorText)
      return NextResponse.json(
        { error: `Webhook error: ${response.status}` },
        { status: response.status }
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
    return NextResponse.json(
      { error: 'Failed to fetch reportee tickets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

