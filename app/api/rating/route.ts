import { NextRequest, NextResponse } from 'next/server'

const DOCTYPE = "Request Tickets"

// GET /api/rating - Calculate average rating for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user = searchParams.get('user')

    if (!user) {
      return NextResponse.json({ error: 'User parameter required' }, { status: 400 })
    }


    // Get accepted tickets assigned to user
    const filters = JSON.stringify([["assigned_to_user", "=", user], ["status", "=", "Accepted"]])
    const fields = JSON.stringify(["name", "action_status"])
    
    const frappeUrl = `https://zeff.valuepitch.ai/api/resource/${encodeURIComponent(DOCTYPE)}?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit=0`
    
    const response = await fetch(frappeUrl, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Frappe API error: ${response.status}`)
    }

    const data = await response.json()
    const tickets = data.data || []

    // Calculate average rating from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

    let allRatings: number[] = []

    for (const ticket of tickets) {
      if (ticket.action_status && Array.isArray(ticket.action_status)) {
        for (const action of ticket.action_status) {
          if (action.rating && action.status_update_latest_time) {
            const updateDate = action.status_update_latest_time.slice(0, 10)
            
            if (updateDate >= sevenDaysAgoStr) {
              // Convert Frappe rating (0-1) to 1-5 scale
              const rating = action.rating >= 0 && action.rating <= 1 ? action.rating * 5 : action.rating
              if (rating > 0) {
                allRatings.push(rating)
              }
            }
          }
        }
      }
    }

    const avgRating = allRatings.length > 0 ? 
      allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length : 0

    return NextResponse.json({ avgRating })

  } catch (error) {
    console.error('Error calculating rating:', error)
    return NextResponse.json({ error: 'Failed to calculate rating' }, { status: 500 })
  }
}
