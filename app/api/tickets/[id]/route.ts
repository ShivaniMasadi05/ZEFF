import { NextRequest, NextResponse } from 'next/server'

const DOCTYPE = "Request Tickets"

// GET /api/tickets/[id] - Get specific ticket
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {

    // Fetch ticket - explicitly request link and attachment fields
    const frappeUrl = `https://zeff.valuepitch.ai/api/resource/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(params.id)}`
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : (request.headers.get('cookie') || '')

    const response = await fetch(frappeUrl, {
      headers: {
        'Cookie': forwardCookie,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Frappe API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Debug logging to see what fields are returned
    if (data?.data) {
      const ticketData = data.data
      console.log(`[Ticket Detail API] Ticket ${params.id} fields:`, Object.keys(ticketData))
      console.log(`[Ticket Detail API] Ticket ${params.id} link:`, ticketData.link)
      console.log(`[Ticket Detail API] Ticket ${params.id} attachment:`, ticketData.attachment)
      console.log(`[Ticket Detail API] Ticket ${params.id} full data:`, JSON.stringify(ticketData, null, 2))
      
      // Check if link/attachment fields exist (even if empty)
      console.log(`[Ticket Detail API] Has 'link' key:`, 'link' in ticketData)
      console.log(`[Ticket Detail API] Has 'attachment' key:`, 'attachment' in ticketData)
    }
    
    return NextResponse.json({ ticket: data.data })

  } catch (error) {
    console.error('Error fetching ticket:', error)
    
    // Fallback to mock data when connection fails (dev-team branch)
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return NextResponse.json({ ticket: {
      name: params.id,
      raised_by: 'Guest',
      assigned_to_user: 'Guest',
      what_is_issueidea: 'Sample ticket (fallback)',
      when_do_i_need_this_by: new Date(Date.now() + 2*24*60*60*1000).toISOString().slice(0,10),
      severity_business_impact: 'Low',
      business_impact: 'Cost',
      creation: now,
      status: 'Created',
      notes: '',
      status_update_latest_time: now,
      action_status: []
    } })
  }
}

// PUT /api/tickets/[id] - Update ticket
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    
    const frappeUrl = `https://zeff.valuepitch.ai/api/resource/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(params.id)}`
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : (request.headers.get('cookie') || '')

    const response = await fetch(frappeUrl, {
      method: 'PUT',
      headers: {
        'Cookie': forwardCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Frappe API error: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
