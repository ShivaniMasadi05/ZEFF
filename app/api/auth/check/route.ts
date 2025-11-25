import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Prefer our same-origin persisted Frappe SID and forward it as `sid`
    const incomingCookies = request.headers.get('cookie') || ''
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : incomingCookies

    const response = await fetch('https://zeff.valuepitch.ai/api/method/frappe.auth.get_logged_user', {
      method: 'GET',
      headers: {
        'Cookie': forwardCookie,
      },
    })

    const data = await response.json()
    
    // Forward the response with cookies
    const nextResponse = NextResponse.json(data)
    
    // Copy cookies from Frappe response to Next.js response
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      nextResponse.headers.set('set-cookie', setCookieHeader)
      // Also persist the Frappe SID for subsequent API calls
      const sidMatch = setCookieHeader.match(/sid=([^;]+)/)
      if (sidMatch && sidMatch[1]) {
        nextResponse.cookies.set('frappe_sid', sidMatch[1], {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/'
        })
      }
    }
    
    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: 'Authentication check failed' }, { status: 500 })
  }
}

