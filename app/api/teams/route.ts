import { NextRequest, NextResponse } from 'next/server'

// GET /api/teams - Fetch team members (users)
export async function GET(request: NextRequest) {
  try {
    // Only allow MOCK_API in development mode
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (process.env.MOCK_API === '1' && isDevelopment) {
      console.log('[Teams API] Using mock data (development mode)')
      return NextResponse.json({ members: [
        { id: 'alice@example.com', name: 'Alice' },
        { id: 'bob@example.com', name: 'Bob' },
        { id: 'carol@example.com', name: 'Carol' }
      ] })
    }

    // Fetch users with both id and full name
    const frappeUrl = `https://zeff.valuepitch.ai/api/resource/User?fields=["name","full_name"]&limit=0`
    
    // Forward Frappe session; prefer persisted frappe_sid
    const cookiesHeader = request.headers.get('cookie') || ''
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : cookiesHeader

    console.log('[Teams API] Fetching users from Frappe, has frappeSid:', !!frappeSid)

    const response = await fetch(frappeUrl, {
      headers: {
        'Cookie': forwardCookie,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[Teams API] Frappe API error: ${response.status}`, errorText)
      throw new Error(`Frappe API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('[Teams API] Received data from Frappe, data type:', typeof data, 'has data.data:', !!data?.data)
    
    const members = Array.isArray(data?.data)
      ? data.data
          .map((u: any) => ({ id: u.name, name: u.full_name || u.name }))
          .filter((u: any) => u && u.id && u.name)
      : []
    
    console.log(`[Teams API] Returning ${members.length} team members`)
    return NextResponse.json({ members })

  } catch (error) {
    console.error('[Teams API] Error fetching teams:', error)
    
    // In production, return empty array instead of mock data
    // In development, allow fallback to mock data for testing
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (isDevelopment && process.env.MOCK_API === '1') {
      console.log('[Teams API] Using mock data fallback (development mode)')
      return NextResponse.json({ members: [
        { id: 'alice@example.com', name: 'Alice' },
        { id: 'bob@example.com', name: 'Bob' },
        { id: 'carol@example.com', name: 'Carol' }
      ] })
    }
    
    // Production: return empty array to avoid showing mock data
    // But also return error info for debugging
    console.warn('[Teams API] Returning empty members array due to error')
    return NextResponse.json({ 
      members: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
