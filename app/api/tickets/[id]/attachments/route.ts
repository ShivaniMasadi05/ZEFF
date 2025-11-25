import { NextRequest, NextResponse } from 'next/server'

const DOCTYPE = "Request Tickets"

// GET /api/tickets/[id]/attachments - list file attachments for a ticket
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : (request.headers.get('cookie') || '')

    // Query File doctype by attachment linkage
    const fields = encodeURIComponent(JSON.stringify(["file_url", "file_name"]))
    const filters = encodeURIComponent(JSON.stringify([
      ["attached_to_doctype", "=", DOCTYPE],
      ["attached_to_name", "=", params.id]
    ]))
    const url = `https://zeff.valuepitch.ai/api/resource/File?fields=${fields}&filters=${filters}&limit=0`

    const response = await fetch(url, {
      headers: {
        'Cookie': forwardCookie,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Frappe File API error ${response.status}: ${text.substring(0,200)}`)
    }

    const data = await response.json()
    const files = Array.isArray(data?.data) ? data.data : []
    const attachments = files.map((f: any) => ({ url: f.file_url, name: f.file_name }))

    return NextResponse.json({ attachments })
  } catch (error) {
    console.error('[Attachments API] Error:', error)
    return NextResponse.json({ attachments: [] })
  }
}



