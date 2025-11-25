import { NextRequest, NextResponse } from 'next/server'

const DOCTYPE = "Request Tickets"

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/tickets - Fetch tickets based on type and user
export async function GET(request: NextRequest) {
  // Make user and type available to the catch block to avoid ReferenceError
  let requestUser: string | null = null
  let type: string | null = null
  
  try {
    const { searchParams } = new URL(request.url)
    type = searchParams.get('type')
    const user = searchParams.get('user')
    requestUser = user

    // ===== DIAGNOSTIC LOGGING =====
    console.log('\n========== TICKETS API REQUEST ==========')
    console.log('[DIAG] Full request URL:', request.url)
    console.log('[DIAG] Type from query:', type)
    console.log('[DIAG] User from query:', user)
    console.log('[DIAG] User type:', typeof user)
    console.log('[DIAG] User length:', user?.length)
    console.log('[DIAG] User trimmed:', user?.trim())
    console.log('========================================\n')

    if (!user) {
      return NextResponse.json({ error: 'User parameter required' }, { status: 400 })
    }


    let filters: any[] = []
    
    switch (type) {
      case 'raised':
        filters = [["raised_by", "=", user]]
        break
      case 'assigned':
        filters = [["assigned_to_user", "=", user], ["raised_by", "!=", user]]
        break
      case 'self':
        filters = [["raised_by", "=", user], ["assigned_to_user", "=", user]]
        break
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    const fields = JSON.stringify([
      "name", "raised_by", "assigned_to_user", "who_can_solve_this", "what_is_issueidea",
      "when_do_i_need_this_by", "severity_business_impact", "business_impact",
      "creation", "status", "notes", "status_update_latest_time", "action_status",
      "reporting_manager_user",
      // Include attachment fields persisted in Frappe
      "link", "attachment"
    ])
    // Get all cookies from the request and prefer our persisted Frappe SID
    const cookiesHeader = request.headers.get('cookie') || ''
    const frappeSid = request.cookies.get('frappe_sid')?.value
    const forwardCookie = frappeSid ? `sid=${frappeSid}` : cookiesHeader
    
    const flt = JSON.stringify(filters)
    const frappeUrl = `https://zeff.valuepitch.ai/api/resource/${encodeURIComponent(DOCTYPE)}?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(flt)}&limit=0`
    
    console.log(`[Tickets API] Fetching from Frappe: Type=${type}, User=${user}, UsingSID=${!!frappeSid}`)
    
    
    const response = await fetch(frappeUrl, {
      headers: {
        'Cookie': forwardCookie,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      cache: 'no-store' // Ensure fresh data
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Tickets API] Frappe API error ${response.status}:`, errorText.substring(0, 200))
      throw new Error(`Frappe API error: ${response.status} - ${errorText.substring(0, 100)}`)
    }

    let data: any
    try {
      const responseText = await response.text()
      console.log(`[Tickets API] Raw response (first 500 chars):`, responseText.substring(0, 500))
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[Tickets API] Failed to parse JSON response:', parseError)
      throw new Error('Invalid JSON response from Frappe API')
    }
    
    // Log the parsed response for debugging
    console.log(`[Tickets API] Type: ${type}, User: ${user}, Data structure:`, {
      hasData: !!data?.data,
      isArray: Array.isArray(data?.data),
      length: Array.isArray(data?.data) ? data.data.length : 0,
      keys: Object.keys(data || {})
    })
    
    // Handle Frappe API response structure
    // Frappe returns { data: [...] } for successful responses
    const tickets = data?.data || data || []
    
    // Ensure tickets is an array
    const ticketsArray = Array.isArray(tickets) ? tickets : []
    
    console.log(`[Tickets API] Returning ${ticketsArray.length} tickets for type: ${type}`)
    
    // Return actual data even if empty - don't use mock data here
    // Only use mock data in catch block for actual errors
    return NextResponse.json({ tickets: ticketsArray }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error fetching tickets:', error)
    
    // Fallback to mock data when connection fails (dev-team branch)
    // Extract type from URL directly in catch block as fallback
    let fallbackType = 'raised'
    try {
      const urlParams = new URL(request.url).searchParams
      const urlType = urlParams.get('type')
      if (urlType && (urlType === 'raised' || urlType === 'assigned' || urlType === 'self')) {
        fallbackType = urlType
      }
    } catch (urlError) {
      // If we can't parse URL, use default
    }
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const mockTicket = {
      name: 'REQ-0001',
      raised_by: requestUser || 'Guest',
      assigned_to_user: requestUser || 'Guest',
      what_is_issueidea: 'Sample ticket (fallback)',
      when_do_i_need_this_by: new Date(Date.now() + 3*24*60*60*1000).toISOString().slice(0,10),
      severity_business_impact: 'Medium',
      business_impact: 'Speed/Blocker/Efficiency/Productivity',
      creation: now,
      status: 'Created',
      notes: '',
      status_update_latest_time: now,
      action_status: []
    }
    const lists: Record<string, any[]> = {
      raised: [mockTicket],
      assigned: [mockTicket],
      self: [mockTicket]
    }
    return NextResponse.json({ tickets: lists[fallbackType] || [] }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}

// POST /api/tickets - Create new ticket
export async function POST(request: NextRequest) {
  try {
    // MOCK: Short-circuit creation
    if (process.env.MOCK_API === '1') {
      const contentType = request.headers.get('content-type') || ''
      let body: any
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData()
        body = Object.fromEntries(formData.entries())
      } else {
        body = await request.json()
      }
      return NextResponse.json({ success: true, data: { data: { name: 'REQ-NEW', ...body } } })
    }

    const contentType = request.headers.get('content-type') || ''
    let body: any
    
    // Handle both FormData and JSON
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      
      // Extract all form fields
      body = {
        what_is_issueidea: formData.get('what_is_issueidea')?.toString() || '',
        who_can_solve_this: formData.get('who_can_solve_this')?.toString() || '',
        when_do_i_need_this_by: formData.get('when_do_i_need_this_by')?.toString() || '',
        business_impact: formData.get('business_impact')?.toString() || '',
        severity_business_impact: formData.get('severity_business_impact')?.toString() || '',
        raised_by: formData.get('raised_by')?.toString() || '',
        assigned_to_user: formData.get('assigned_to_user')?.toString() || '',
        link: formData.get('link')?.toString() || '',  // Field name: "link"
      }
      
      // For file attachment, get the File object and upload to Frappe
      const attachmentFile = formData.get('attachment') as File | null
      if (attachmentFile && attachmentFile instanceof File) {
        try {
          // Upload file to Frappe File API
          const frappeSid = request.cookies.get('frappe_sid')?.value
          const forwardCookie = frappeSid ? `sid=${frappeSid}` : (request.headers.get('cookie') || '')
          
          const arrayBuffer = await attachmentFile.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString('base64')
          
          // Upload to Frappe File API using multipart form data
          const fileUploadUrl = 'https://zeff.valuepitch.ai/api/method/upload_file'
          const fileUploadFormData = new FormData()
          const fileBlob = new Blob([arrayBuffer], { type: attachmentFile.type })
          fileUploadFormData.append('file', fileBlob, attachmentFile.name)
          fileUploadFormData.append('is_private', '0')
          fileUploadFormData.append('folder', 'Home/Attachments')
          
          const fileUploadResponse = await fetch(fileUploadUrl, {
            method: 'POST',
            headers: {
              'Cookie': forwardCookie
              // Don't set Content-Type header - let browser set it with boundary for FormData
            },
            body: fileUploadFormData
          })
          
          if (fileUploadResponse.ok) {
            const fileData = await fileUploadResponse.json()
            // Frappe upload_file returns file in message object
            const uploadedFile = fileData?.message || {}
            const fileUrl = uploadedFile?.file_url || uploadedFile?.file_name || ''
            
            if (fileUrl) {
              body.attachment = fileUrl  // Save the file URL/path in attachment field
              console.log('[Create Ticket API] File uploaded to Frappe successfully:', {
                name: attachmentFile.name,
                fileUrl: fileUrl,
                fullResponse: uploadedFile
              })
            } else {
              console.error('[Create Ticket API] No file_url in Frappe response:', fileData)
              body.attachment = attachmentFile.name  // Fallback to filename
            }
          } else {
            const errorText = await fileUploadResponse.text().catch(() => 'Unknown error')
            console.error('[Create Ticket API] Error uploading file to Frappe:', fileUploadResponse.status, errorText)
            body.attachment = attachmentFile.name  // Fallback to filename
          }
        } catch (error) {
          console.error('[Create Ticket API] Error uploading file:', error)
          body.attachment = attachmentFile.name  // Fallback to filename
        }
      } else {
        body.attachment = ''
      }
    } else {
      body = await request.json()
    }
    
    // Use webhook API for ticket creation
    const webhookUrl = 'https://automation.lendingcube.ai/webhook/user-creation-zeff'
    
    // Extract link and attachment - ensure field names match Frappe exactly: "link" and "attachment"
    // Ensure we always have strings, never null or undefined
    let link = ''
    if (typeof body.link === 'string') {
      link = body.link.trim()
    } else if (body.link !== null && body.link !== undefined) {
      link = String(body.link).trim()
    }
    
    let attachment = ''
    if (typeof body.attachment === 'string') {
      attachment = body.attachment.trim()
    } else if (body.attachment !== null && body.attachment !== undefined) {
      attachment = String(body.attachment).trim()
    } else if (body.attachment?.name) {
      attachment = String(body.attachment.name).trim()
    }
    
    console.log('[Create Ticket API] Extracted link and attachment:', {
      link: link || '(empty)',
      attachment: attachment || '(empty)',
      linkType: typeof link,
      attachmentType: typeof attachment,
      bodyLink: body.link,
      bodyAttachment: body.attachment
    })
    
    const ticketData = {
      what_is_issueidea: body.what_is_issueidea || '',
      who_can_solve_this: body.who_can_solve_this || '',
      when_do_i_need_this_by: body.when_do_i_need_this_by || '',
      business_impact: body.business_impact || '',
      severity_business_impact: body.severity_business_impact || '',
      status: 'Created',
      raised_by: body.raised_by || '',
      assigned_to_user: body.assigned_to_user || '',
      frappe_user: body.raised_by || '',
      link: link && link.trim() ? link.trim() : null,  // Send non-empty link value or null
      attachment: attachment && attachment.trim() ? attachment.trim() : null  // Send non-empty attachment value or null
    }
    
    // Log the ticket data being sent to webhook (ensure field names are exactly "link" and "attachment")
    console.log('[Create Ticket API] Sending to webhook with fields:', {
      what_is_issueidea: ticketData.what_is_issueidea,
      who_can_solve_this: ticketData.who_can_solve_this,
      when_do_i_need_this_by: ticketData.when_do_i_need_this_by,
      business_impact: ticketData.business_impact,
      severity_business_impact: ticketData.severity_business_impact,
      status: ticketData.status,
      raised_by: ticketData.raised_by,
      assigned_to_user: ticketData.assigned_to_user,
      link: link || '(empty)',  // Frappe field: "link"
      attachment: attachment || '(empty)',  // Frappe field: "attachment"
      hasAttachmentFile: !!(ticketData as any).attachment_file
    })
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ticketData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Webhook API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    console.log('[Create Ticket API] Webhook response:', JSON.stringify(data, null, 2))
    
    // After webhook creates ticket, update it directly via Frappe API to ensure link and attachment are saved
    // Try multiple possible response formats
    const createdTicketName = data?.message?.name || 
                              data?.message?.data?.name ||
                              data?.data?.name || 
                              data?.data?.data?.name ||
                              data?.name || 
                              null
    
    console.log('[Create Ticket API] Extracted ticket name:', createdTicketName)
    
    if (createdTicketName) {
      try {
        // Wait a short time to ensure ticket is fully created before updating
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const frappeSid = request.cookies.get('frappe_sid')?.value
        const forwardCookie = frappeSid ? `sid=${frappeSid}` : (request.headers.get('cookie') || '')
        
        const updateUrl = `https://zeff.valuepitch.ai/api/resource/${encodeURIComponent(DOCTYPE)}/${encodeURIComponent(createdTicketName)}`
        
        // Always update both fields - use actual values or empty string
        const updateData: any = {
          link: (link && link.trim()) || '',  // Use trimmed link value or empty string
          attachment: (attachment && attachment.trim()) || ''  // Use trimmed attachment value or empty string
        }
        
        console.log('[Create Ticket API] Updating ticket via Frappe API:', {
          ticketName: createdTicketName,
          updateUrl: updateUrl,
          updateData: updateData,
          linkValue: link || '(empty string)',
          attachmentValue: attachment || '(empty string)'
        })
        
        const updateResponse = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Cookie': forwardCookie,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })
        
        if (updateResponse.ok) {
          const updateResult = await updateResponse.json()
          const updatedData = updateResult?.data || updateResult
          console.log('[Create Ticket API] Successfully updated ticket with link/attachment:', {
            ticketName: createdTicketName,
            link: link || '(empty)',
            attachment: attachment || '(empty)',
            updateResponse: updatedData,
            linkInResponse: updatedData?.link,
            attachmentInResponse: updatedData?.attachment
          })
        } else {
          const errorText = await updateResponse.text().catch(() => 'Unknown error')
          console.error('[Create Ticket API] Error updating ticket with link/attachment:', {
            status: updateResponse.status,
            statusText: updateResponse.statusText,
            error: errorText.substring(0, 500),
            ticketName: createdTicketName,
            updateUrl: updateUrl
          })
        }
      } catch (error) {
        console.error('[Create Ticket API] Error updating ticket after creation:', error)
        // Don't fail the request if update fails - ticket was created successfully
      }
    } else {
      console.error('[Create Ticket API] Could not extract ticket name from webhook response:', JSON.stringify(data, null, 2))
    }
    
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
