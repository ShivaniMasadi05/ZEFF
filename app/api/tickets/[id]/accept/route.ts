import { NextRequest, NextResponse } from 'next/server'

const DOCTYPE = "Request Tickets"

// POST /api/tickets/[id]/accept - Accept ticket with rating
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { level, notes } = body
    
    console.log('Accept API - Received data:', { level, notes })
    
    if (!level) {
      return NextResponse.json({ error: 'Level is required' }, { status: 400 })
    }


    // Prepare auth headers
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : (request.headers.get('cookie') || '')
    const csrfToken = request.headers.get('x-frappe-csrf-token') || undefined

    // Get current ticket data
    const getUrl = `https://zeff.valuepitch.ai/api/resource/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(params.id)}`
    const getHeaders: Record<string, string> = {
      'Cookie': forwardCookie,
      'Content-Type': 'application/json'
    }
    if (csrfToken) {
      getHeaders['X-Frappe-CSRF-Token'] = csrfToken
    }

    const getResponse = await fetch(getUrl, {
      headers: getHeaders
    })

    if (!getResponse.ok) {
      throw new Error(`Failed to fetch ticket: ${getResponse.status}`)
    }

    const currentTicket = await getResponse.json()
    const currentData = currentTicket.data

    // Convert level to rating
    const levelToRating = {
      'L1': 0.2,
      'L2': 0.4,
      'L3': 0.6,
      'L4': 0.8,
      'L5': 1.0
    }
    const rating = levelToRating[level as keyof typeof levelToRating] || 0.2

    // Update action_status array
    let rows = Array.isArray(currentData.action_status) ? currentData.action_status : []
    const nowISO = new Date().toISOString().slice(0, 19).replace("T", " ")

    rows = [...rows, {
      status: "Accepted",
      rating: rating,
      status_update_latest_time: nowISO,
      updated_by: currentData.raised_by, // You might want to get this from session
      notes: notes || "",
      doctype: "Status"
    }]

    // Update ticket
    const updateData = {
      status: "Accepted",
      status_update_latest_time: nowISO,
      action_status: rows
    }

    const updateUrl = `https://zeff.valuepitch.ai/api/resource/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(params.id)}`
    const updateHeaders: Record<string, string> = {
      'Cookie': forwardCookie,
      'Content-Type': 'application/json'
    }
    if (csrfToken) {
      updateHeaders['X-Frappe-CSRF-Token'] = csrfToken
    }

    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: updateHeaders,
      body: JSON.stringify(updateData)
    })

    if (!updateResponse.ok) {
      let errorText = `Frappe API error: ${updateResponse.status}`
      try {
        const errorData = await updateResponse.json()
        errorText = `Frappe API error: ${JSON.stringify(errorData)}`
      } catch (parseError) {
        // ignore parse error, keep status text
      }
      throw new Error(errorText)
    }

    const data = await updateResponse.json()
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('Error accepting ticket:', error)
    return NextResponse.json({ error: 'Failed to accept ticket' }, { status: 500 })
  }
}
