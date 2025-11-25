import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    
    const response = await fetch('https://zeff.valuepitch.ai/api/method/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    })

    const data = await response.json()
    
    // Create response with same status
    const nextResponse = NextResponse.json(data, { status: response.status })
    
    // Copy cookies from Frappe response to Next.js response
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      nextResponse.headers.set('set-cookie', setCookieHeader)
      // Also persist the Frappe SID into a same-origin cookie so we can forward it on API calls
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
    // If JSON payload includes sid, persist it as well (some setups return sid in body)
    if ((data as any)?.sid) {
      nextResponse.cookies.set('frappe_sid', (data as any).sid, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      })
    }
    
    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

