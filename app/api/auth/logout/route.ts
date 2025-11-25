import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const response = await fetch('https://zeff.valuepitch.ai/api/method/logout', {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })

    const data = await response.json()
    
    // Create response with same status
    const nextResponse = NextResponse.json(data, { status: response.status })
    
    // Clear cookies by setting them to expire
    const cookies = request.headers.get('cookie')
    if (cookies) {
      const cookieArray = cookies.split(';')
      cookieArray.forEach(cookie => {
        const [name] = cookie.trim().split('=')
        if (name) {
          nextResponse.cookies.set(name, '', {
            expires: new Date(0),
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
          })
        }
      })
    }
    // Also clear our persisted Frappe SID
    nextResponse.cookies.set('frappe_sid', '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
    
    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}

