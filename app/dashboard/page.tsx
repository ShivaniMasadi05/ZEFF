'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import './dashboard.css'

interface Ticket {
  name: string
  raised_by: string
  assigned_to_user: string
  who_can_solve_this?: string
  what_is_issueidea: string
  when_do_i_need_this_by: string
  severity_business_impact: string
  business_impact: string
  creation: string
  status: string
  notes: string
  status_update_latest_time: string
  link?: string
  attachment?: string
  reporting_manager_user?: string
  action_status?: Array<{
    status: string
    rating?: number
    status_update_latest_time: string
    updated_by: string
    notes: string
  }>
}

interface Team {
  name: string
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<string>('Guest')
  const [tickets, setTickets] = useState<{
    raised: Ticket[]
    assigned: Ticket[]
    selfAssigned: Ticket[]
    archived: Ticket[]
    reportingManager: Ticket[]
  }>({
    raised: [],
    assigned: [],
    selfAssigned: [],
    archived: [],
    reportingManager: []
  })


  const [teams, setTeams] = useState<Team[]>([])
  const [avgRating, setAvgRating] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'raised' | 'assigned' | 'self' | 'reporting_manager' | 'archived'>('raised')
  const [showImpactModal, setShowImpactModal] = useState(false)
  const [showEditLevelModal, setShowEditLevelModal] = useState(false)
  const [editLevelContext, setEditLevelContext] = useState<{
    ticketName: string
    actionIndex: number
    currentLevel: string
  } | null>(null)
  const [showViewLinkModal, setShowViewLinkModal] = useState(false)
  const [viewLinkUrl, setViewLinkUrl] = useState<string>('')
  const [showViewAttachmentModal, setShowViewAttachmentModal] = useState(false)
  const [viewAttachmentUrl, setViewAttachmentUrl] = useState<string>('')
  const [formData, setFormData] = useState({
    whatIssue: '',
    whoCanSolve: '',
    needByDate: '',
    businessImpact: '',
    severityImpact: '',
    link: '',
    attachment: null as File | null
  })
  const [formErrors, setFormErrors] = useState({
    whatIssue: '',
    whoCanSolve: '',
    needByDate: '',
    linkOrAttachment: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<string>('')
  const [selectedEditLevel, setSelectedEditLevel] = useState<string>('')
  const router = useRouter()
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string, name: string }>>([])
  const [displayNeedByDate, setDisplayNeedByDate] = useState<string>('')
  const datePickerRef = useRef<HTMLInputElement>(null)

  // Helper function to convert relative URLs to absolute URLs
  const getAbsoluteAttachmentUrl = (url: string): string => {
    if (!url) return url
    // Check if URL is a directory path (ends with / but no file extension)
    const trimmedUrl = url.trim()
    if (trimmedUrl.endsWith('/') && !trimmedUrl.match(/\.[a-zA-Z0-9]+$/)) {
      // This appears to be a directory, not a file
      console.warn('Attachment URL appears to be a directory:', trimmedUrl)
      return url // Return as-is, will be handled by error handler
    }
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl
    }
    // If URL starts with /, it's a relative path from root
    if (trimmedUrl.startsWith('/')) {
      return `https://zeff.valuepitch.ai${trimmedUrl}`
    }
    // Otherwise, prepend base URL with trailing slash
    return `https://zeff.valuepitch.ai/${trimmedUrl}`
  }

  // Helper function to check if URL is a valid file URL
  const isValidFileUrl = (url: string): boolean => {
    if (!url || !url.trim()) return false
    const trimmedUrl = url.trim()
    // Check if it ends with a directory separator (likely a directory)
    if (trimmedUrl.endsWith('/') && !trimmedUrl.match(/\.[a-zA-Z0-9]+$/)) {
      return false
    }
    // Check if it has a file extension or is a valid URL
    return trimmedUrl.includes('.') || trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/check", { 
        credentials: "include" 
      })
      
      if (!response.ok) {
        // Use window.location for reliable redirect in production
        if (typeof window !== 'undefined') {
          window.location.replace('/')
        } else {
          router.push('/')
        }
        return
      }
      
      const data = await response.json()
      if (!data || !data.message || data.message === "Guest") {
        // Use window.location for reliable redirect in production
        if (typeof window !== 'undefined') {
          window.location.replace('/')
        } else {
          router.push('/')
        }
      } else {
        setUser(data.message)
        await loadData(data.message)
        setLoading(false)
      }
    } catch (error) {
      // Use window.location for reliable redirect in production
      if (typeof window !== 'undefined') {
        window.location.replace('/')
      } else {
        router.push('/')
      }
    }
  }

  const loadData = async (currentUser: string) => {
    try {
      await Promise.all([
        loadTeams(),
        loadTickets(currentUser),
        calculateAvgRating()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const loadTeams = async () => {
    try {
      console.log('[Dashboard] Fetching team members...')
      const response = await fetch('/api/teams', { credentials: 'include' })
      
      if (response.ok) {
        const data = await response.json()
        const members = Array.isArray(data.members) ? data.members : []
        console.log(`[Dashboard] Loaded ${members.length} team members:`, members)
        setTeamMembers(members)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[Dashboard] Failed to load teams:', response.status, errorData)
        setTeamMembers([])
      }
    } catch (error) {
      console.error('[Dashboard] Error loading teams:', error)
      setTeamMembers([])
    }
  }

  const loadReporteeTickets = async (currentUser: string): Promise<Ticket[]> => {
    try {
      console.log('[Dashboard] Loading reportee tickets for user:', currentUser)
      
      const response = await fetch('/api/reportee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store' as RequestCache,
        body: JSON.stringify({}) // Email will be retrieved from session in API route
      })
      
      if (!response.ok) {
        console.error('[Dashboard] Failed to fetch reportee tickets:', response.status)
        return []
      }
      
      const data = await response.json()
      
      // Handle both array response and wrapped response
      let reporteeTickets: Ticket[] = []
      if (Array.isArray(data.tickets)) {
        reporteeTickets = data.tickets
      } else if (Array.isArray(data)) {
        reporteeTickets = data
      } else if (Array.isArray(data.data)) {
        reporteeTickets = data.data
      }
      
      console.log('[Dashboard] Loaded', reporteeTickets.length, 'reportee tickets')
      return reporteeTickets
    } catch (error) {
      console.error('[Dashboard] Error loading reportee tickets:', error)
      return []
    }
  }

  const loadTickets = async (currentUser: string) => {
  try {
    console.log('\n========== DASHBOARD LOADING TICKETS ==========')
    console.log('[Dashboard] Loading tickets for user:', currentUser)
    console.log('[Dashboard] User type:', typeof currentUser)
    console.log('[Dashboard] User length:', currentUser?.length)
    // Add cache-busting timestamp to ensure fresh data
    const cacheBuster = `&_t=${Date.now()}`
    const fetchOptions = { 
      credentials: 'include' as RequestCredentials,
      cache: 'no-store' as RequestCache,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }
    
    const [raisedRes, assignedRes, selfRes, reporteeTickets] = await Promise.all([
      fetch(`/api/tickets?type=raised&user=${encodeURIComponent(currentUser)}${cacheBuster}`, fetchOptions),
      fetch(`/api/tickets?type=assigned&user=${encodeURIComponent(currentUser)}${cacheBuster}`, fetchOptions),
      fetch(`/api/tickets?type=self&user=${encodeURIComponent(currentUser)}${cacheBuster}`, fetchOptions),
      loadReporteeTickets(currentUser)
    ])

    const [raised, assigned, self] = await Promise.all([
      raisedRes.ok ? raisedRes.json().catch(() => ({ data: [] })) : { data: [] },
      assignedRes.ok ? assignedRes.json().catch(() => ({ data: [] })) : { data: [] },
      selfRes.ok ? selfRes.json().catch(() => ({ data: [] })) : { data: [] }
    ])

    // Ensure we have arrays - handle both { tickets: [...] } and direct array responses
    // Also handle case where response might be { data: { tickets: [...] } } or other nested structures
    let raisedTickets: Ticket[] = []
    if (Array.isArray(raised.tickets)) {
      raisedTickets = raised.tickets
    } else if (Array.isArray(raised)) {
      raisedTickets = raised
    } else if (raised?.data && Array.isArray(raised.data)) {
      raisedTickets = raised.data
    } else if (raised?.data?.tickets && Array.isArray(raised.data.tickets)) {
      raisedTickets = raised.data.tickets
    }
    
    let assignedTickets: Ticket[] = []
    if (Array.isArray(assigned.tickets)) {
      assignedTickets = assigned.tickets
    } else if (Array.isArray(assigned)) {
      assignedTickets = assigned
    } else if (assigned?.data && Array.isArray(assigned.data)) {
      assignedTickets = assigned.data
    } else if (assigned?.data?.tickets && Array.isArray(assigned.data.tickets)) {
      assignedTickets = assigned.data.tickets
    }
    
    let selfTickets: Ticket[] = []
    if (Array.isArray(self.tickets)) {
      selfTickets = self.tickets
    } else if (Array.isArray(self)) {
      selfTickets = self
    } else if (self?.data && Array.isArray(self.data)) {
      selfTickets = self.data
    } else if (self?.data?.tickets && Array.isArray(self.data.tickets)) {
      selfTickets = self.data.tickets
    }
    
    console.log('[Dashboard] Tickets loaded:', {
      raised: raisedTickets.length,
      assigned: assignedTickets.length,
      self: selfTickets.length,
      reportee: reporteeTickets.length
    })

    // Separate accepted tickets
    const allTickets = [
      ...raisedTickets,
      ...assignedTickets,
      ...selfTickets,
      ...reporteeTickets
    ]
    const archivedShallow = allTickets.filter(t => t.status === "Accepted")

    // Build recent "Who can solve" options from previous assignments
    const previousSolvers = Array.from(new Set(
      allTickets
        .flatMap((t: Ticket) => [
          (t.assigned_to_user || '').trim(),
          (t.who_can_solve_this || '').trim()
        ])
        .filter(v => v && v !== user)
    )).slice(0, 10)
    // setRecentSolvers(previousSolvers) // This line is no longer needed

    // Fetch full details for archived tickets to ensure action_status (with acceptance notes) is present
    const archived = await Promise.all(
      archivedShallow.map(async (t) => {
        try {
          const res = await fetch(`/api/tickets/${encodeURIComponent(t.name)}`, { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            return { ...t, ...(data.ticket || {}) }
          }
        } catch (_) {}
        return t
      })
    )

    // Sort tickets by creation date (newest first)
    const sortByCreationDate = (tickets: Ticket[]) => {
      return tickets.sort((a, b) => {
        const dateA = new Date(a.creation || a.status_update_latest_time || 0)
        const dateB = new Date(b.creation || b.status_update_latest_time || 0)
        return dateB.getTime() - dateA.getTime() // Newest first
      })
    }

    // Sort archived tickets by acceptance date (newest first)
    const sortByAcceptanceDate = (tickets: Ticket[]) => {
      return tickets.sort((a, b) => {
        // Get acceptance date from action_status array
        const getAcceptanceDate = (ticket: Ticket) => {
          if (ticket.action_status && ticket.action_status.length > 0) {
            const acceptedAction = ticket.action_status.find(action => action.status === "Accepted")
            if (acceptedAction) {
              return new Date(acceptedAction.status_update_latest_time || 0)
            }
          }
          // Fallback to creation date if no acceptance date found
          return new Date(ticket.creation || ticket.status_update_latest_time || 0)
        }

        const dateA = getAcceptanceDate(a)
        const dateB = getAcceptanceDate(b)
        return dateB.getTime() - dateA.getTime() // Newest first
      })
    }

    // Filter out accepted tickets - all other tickets from the "raised" API should be included
    // The API already filters by raised_by, so we just need to exclude "Accepted" status tickets
    // This ensures tickets assigned to other users still appear in "Raised by me" tab
    const nextRaised = sortByCreationDate(
      raisedTickets.filter((t: Ticket) => t.status !== "Accepted")
    )
    const nextAssigned = sortByCreationDate(assignedTickets.filter((t: Ticket) => t.status !== "Accepted"))
    const nextSelf = sortByCreationDate(selfTickets.filter((t: Ticket) => t.status !== "Accepted"))
    const nextArchived = sortByAcceptanceDate(archived)
    
    // Reportee tickets: Show all tickets from webhook (no status filtering)
    const nextReporting = sortByCreationDate(reporteeTickets)

    // Always update with real data from API
    console.log('[Dashboard] Setting tickets:', {
      raised: nextRaised.length,
      assigned: nextAssigned.length,
      selfAssigned: nextSelf.length,
      archived: nextArchived.length,
      reportingManager: nextReporting.length
    })
    setTickets({
      raised: nextRaised,
      assigned: nextAssigned,
      selfAssigned: nextSelf,
      archived: nextArchived,
      reportingManager: nextReporting
    })
  } catch (error) {
    console.error('Error loading tickets:', error)
    // On error, at least set empty arrays to avoid undefined errors
    setTickets({
      raised: [],
      assigned: [],
      selfAssigned: [],
      archived: [],
      reportingManager: []
    })
  }
}


  const calculateAvgRating = async () => {
    try {
      const response = await fetch(`/api/rating?user=${user}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setAvgRating(data.avgRating || 0)
      }
    } catch (error) {
      console.error('Error calculating rating:', error)
    }
  }

  const validateForm = () => {
    const errors = {
      whatIssue: '',
      whoCanSolve: '',
      needByDate: '',
      linkOrAttachment: ''
    }
    
    let isValid = true
    
    if (!formData.whatIssue.trim()) {
      errors.whatIssue = 'Please describe the issue or idea'
      isValid = false
    }
    
    if (!formData.whoCanSolve.trim()) {
      errors.whoCanSolve = 'Please select a team or Myself'
      isValid = false
    }
    
    if (!formData.needByDate) {
      errors.needByDate = 'Please select when you need this by'
      isValid = false
    } else {
      // Check if the selected date is in the past (formData.needByDate is yyyy-mm-dd)
      const selectedDate = new Date(formData.needByDate + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Reset time to start of day for accurate comparison
      
      if (selectedDate < today) {
        errors.needByDate = 'Please select a future date'
        isValid = false
      }
    }
    
    setFormErrors(errors)
    return isValid
  }

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      })
      
      if (response.ok) {
        localStorage.removeItem("zeff_remember")
        router.push('/')
      } else {
        router.push('/')
      }
    } catch (error) {
      router.push('/')
    }
  }

  const handleSubmitRequest = async () => {
    // Prevent multiple submissions
    if (isSubmitting) {
      return
    }

    if (!formData.whatIssue || !formData.needByDate) {
      alert('Please fill in the required fields.')
      return
    }

    // Require team selection via validation above

    if (!formData.businessImpact || !formData.severityImpact) {
      alert('Please complete the impact assessment.')
      return
    }

    setIsSubmitting(true)

    try {
      const selectedAssigneeId = formData.whoCanSolve === "__MYSELF__" ? user : formData.whoCanSolve
      // Get display name for who_can_solve_this field (Frappe expects display name, not email)
      const selectedMember = teamMembers.find(m => m.id === formData.whoCanSolve)
      const whoCanSolveDisplayName = formData.whoCanSolve === "__MYSELF__" ? '' : (selectedMember?.name || '')

      // Use FormData if there's a file, otherwise use JSON
      let requestBody: FormData | string
      let headers: HeadersInit

      if (formData.attachment) {
        // Use FormData for file upload
        const formDataToSend = new FormData()
        formDataToSend.append('what_is_issueidea', formData.whatIssue)
        // who_can_solve_this should be display name, not email - use assigned_to_user for assignment
        formDataToSend.append('who_can_solve_this', whoCanSolveDisplayName)
        formDataToSend.append('when_do_i_need_this_by', formData.needByDate)
        formDataToSend.append('business_impact', formData.businessImpact)
        formDataToSend.append('severity_business_impact', formData.severityImpact)
        formDataToSend.append('status', 'Created')
        formDataToSend.append('raised_by', user)
        formDataToSend.append('assigned_to_user', selectedAssigneeId || '')
        formDataToSend.append('link', formData.link || '')
        formDataToSend.append('attachment', formData.attachment)
        requestBody = formDataToSend
        headers = {}
      } else {
        // Use JSON for regular submission (only link, no file)
        headers = {
          'Content-Type': 'application/json',
        }
        requestBody = JSON.stringify({
          what_is_issueidea: formData.whatIssue,
          // who_can_solve_this should be display name, not email - use assigned_to_user for assignment
          who_can_solve_this: whoCanSolveDisplayName || null,
          when_do_i_need_this_by: formData.needByDate,
          business_impact: formData.businessImpact,
          severity_business_impact: formData.severityImpact,
          status: 'Created',
          raised_by: user,
          assigned_to_user: selectedAssigneeId,
          link: formData.link ? formData.link.trim() : '',
          attachment: ''  // Always include attachment field, even if empty
        })
      }

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: requestBody
      })

      if (response.ok) {
        // Get the response data to get the actual ticket name
        let responseData: any = null
        try {
          responseData = await response.json()
        } catch (e) {
          console.error('Failed to parse response:', e)
        }

        // Determine which tab to show the ticket in
        const isSelfAssigned = formData.whoCanSolve === "__MYSELF__" || selectedAssigneeId === user
        const targetTab = isSelfAssigned ? 'self' : 'raised'

        setFormData({
          whatIssue: '',
          whoCanSolve: '',
          needByDate: '',
          businessImpact: '',
          severityImpact: '',
          link: '',
          attachment: null
        })
        setDisplayNeedByDate('')
        setFormErrors({ whatIssue: '', whoCanSolve: '', needByDate: '', linkOrAttachment: '' })
        // Stop spinner immediately and close modal before background refresh
        setIsSubmitting(false)
        setShowImpactModal(false)
        
        // Switch to the appropriate tab to show the new ticket
        setActiveTab(targetTab)
        
        // Defer blocking alert until after at least one paint so UI updates first
        const showSuccessAlert = () => alert('Request submitted successfully!')
        if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
          requestAnimationFrame(() => {
            setTimeout(showSuccessAlert, 0)
          })
        } else {
          setTimeout(showSuccessAlert, 0)
        }
        
        // Refresh tickets immediately to get the actual ticket from the server
        // Retry mechanism to ensure ticket appears even if backend takes time
        const refreshTickets = async (retries = 3, delay = 500) => {
          for (let i = 0; i < retries; i++) {
            await new Promise(resolve => setTimeout(resolve, delay))
            try {
              await loadTickets(user)
              // If load succeeds, check if we got the new ticket (optional validation)
              break
            } catch (err) {
              console.error(`Error reloading tickets after submission (attempt ${i + 1}/${retries}):`, err)
              if (i === retries - 1) {
                // Last attempt failed, but don't show error to user
                console.error('Failed to reload tickets after all retries')
              }
            }
          }
        }
        refreshTickets()
      } else {
        throw new Error('Failed to submit request')
      }
    } catch (error) {
      alert('Failed to submit request: ' + error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateTicketStatus = async (ticketName: string, status: string, notes: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status,
          notes
        })
      })

      if (response.ok) {
        await loadTickets(user)
      } else {
        throw new Error('Failed to update ticket')
      }
    } catch (error) {
      alert('Update failed: ' + error)
    }
  }

  const acceptTicket = async (ticketName: string, level: string, notes: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketName}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          level,
          notes
        })
      })

      if (response.ok) {
        await loadTickets(user)
        await calculateAvgRating()
      } else {
        throw new Error('Failed to accept ticket')
      }
    } catch (error) {
      alert('Accept failed: ' + error)
    }
  }

  const calculateDeadlineStatus = (ticket: Ticket) => {
    const today = new Date()
    const expectedDate = new Date(ticket.when_do_i_need_this_by + 'T00:00:00')
    const diffTime = expectedDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (ticket.status === "Accepted") {
      const completionDate = new Date(ticket.status_update_latest_time)
      const completionDiffTime = expectedDate.getTime() - completionDate.getTime()
      const completionDiffDays = Math.ceil(completionDiffTime / (1000 * 60 * 60 * 24))
      
      if (completionDiffDays > 0) {
        return {
          text: `Done ${completionDiffDays} day${completionDiffDays > 1 ? 's' : ''} before expected`,
          class: 'completed-early'
        }
      } else if (completionDiffDays === 0) {
        return {
          text: 'Done within timeframe',
          class: 'completed-ontime'
        }
      } else {
        return {
          text: `Delayed by ${Math.abs(completionDiffDays)} day${Math.abs(completionDiffDays) > 1 ? 's' : ''}`,
          class: 'completed-late'
        }
      }
    }

    if (diffDays < 0) {
      return {
        text: `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} overdue`,
        class: 'overdue'
      }
    } else if (diffDays <= 3) {
      return {
        text: `${diffDays} day${diffDays > 1 ? 's' : ''} left`,
        class: 'urgent'
      }
    } else {
      return {
        text: `${diffDays} days left`,
        class: 'normal'
      }
    }
  }

  const getLevelFromRating = (rating: number) => {
    const ratingToLevel: { [key: number]: string } = {
      1: 'L1',
      2: 'L2', 
      3: 'L3',
      4: 'L4',
      5: 'L5'
    }
    return ratingToLevel[Math.round(rating)] || 'L1'
  }

  const displayRating = (rating: number) => {
    if (rating === 0) return '-'
    return getLevelFromRating(rating)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zeff-bg zeff-radial flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <div className="gradient-text text-xl font-semibold">Loading your dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zeff-bg zeff-radial">
      {/* Navigation Bar */}
      <nav className="zeff-navbar">
        <div className="zeff-nav-content">
          <div className="zeff-nav-title-group">
            <h1 className="zeff-nav-title">Zeff</h1>
            <p className="zeff-nav-subtitle">Issues/Ideas/Tasks!</p>
          </div>
          <button
            onClick={handleLogout}
            className="zeff-signout-btn"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div className="container">
        {/* New Request Form */}
        <div className="new-request-form">
          <div className="form-title">Create</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">What's the issue/idea?</label>
              <input 
                type="text" 
                className={`form-input ${formErrors.whatIssue ? 'form-input-error' : ''}`}
                value={formData.whatIssue}
                onChange={(e) => {
                  setFormData({...formData, whatIssue: e.target.value})
                  if (formErrors.whatIssue) {
                    setFormErrors({...formErrors, whatIssue: ''})
                  }
                }}
                placeholder="Describe your issue or idea..." 
                required 
              />
              {formErrors.whatIssue && (
                <div className="form-error">{formErrors.whatIssue}</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Who can solve this?</label>
              <select 
                className={`form-select ${formErrors.whoCanSolve ? 'form-input-error' : ''}`}
                value={formData.whoCanSolve}
                onChange={(e) => {
                  setFormData({...formData, whoCanSolve: e.target.value})
                  if (formErrors.whoCanSolve) {
                    setFormErrors({...formErrors, whoCanSolve: ''})
                  }
                }}
              >
                <option value="">Select team...</option>
                <option value="__MYSELF__">Myself</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              {formErrors.whoCanSolve && (
                <div className="form-error">{formErrors.whoCanSolve}</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">When do I need this by?</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="dd/mm/yyyy"
                className={`form-input ${formErrors.needByDate ? 'form-input-error' : ''}`}
                  value={displayNeedByDate}
                onChange={(e) => {
                    // Allow only digits and '/'; apply simple mask dd/mm/yyyy
                    let v = e.target.value.replace(/[^0-9/]/g, '')
                    if (v.length > 10) v = v.slice(0, 10)
                    if (v.length >= 3 && v[2] !== '/') v = v.slice(0,2) + '/' + v.slice(2)
                    if (v.length >= 6 && v[5] !== '/') v = v.slice(0,5) + '/' + v.slice(5)
                    setDisplayNeedByDate(v)

                    // Convert to yyyy-mm-dd when valid
                    const m = v.match(/^([0-3][0-9])\/(0[1-9]|1[0-2])\/(\d{4})$/)
                    if (m) {
                      const dd = m[1]
                      const mm = m[2]
                      const yyyy = m[3]
                      const iso = `${yyyy}-${mm}-${dd}`
                      setFormData({ ...formData, needByDate: iso })

                      // Clear error if valid and not in past
                      const parsed = new Date(iso + 'T00:00:00')
                      const today = new Date(); today.setHours(0,0,0,0)
                      if (parsed >= today && formErrors.needByDate) {
                        setFormErrors({ ...formErrors, needByDate: '' })
                      }
                      if (parsed < today) {
                        setFormErrors({ ...formErrors, needByDate: 'Please select a future date' })
                      }
                    } else {
                      // Not a valid format yet
                      setFormData({ ...formData, needByDate: '' })
                  }
                }}
                required 
                  style={{ paddingRight: '40px' }}
                />
                <input
                  type="date"
                  ref={datePickerRef}
                  style={{ position: 'absolute', right: '8px', opacity: 0, pointerEvents: 'none', width: '32px', height: '32px', cursor: 'pointer' }}
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.needByDate}
                  onChange={(e) => {
                    const iso = e.target.value
                    setFormData({ ...formData, needByDate: iso })
                    // Convert to dd/mm/yyyy for display
                    if (iso) {
                      const [yyyy, mm, dd] = iso.split('-')
                      setDisplayNeedByDate(`${dd}/${mm}/${yyyy}`)
                    } else {
                      setDisplayNeedByDate('')
                    }
                    // Validation
                    if (iso) {
                      const parsed = new Date(iso + 'T00:00:00')
                      const today = new Date(); today.setHours(0,0,0,0)
                      if (parsed < today) {
                        setFormErrors({ ...formErrors, needByDate: 'Please select a future date' })
                      } else if (formErrors.needByDate) {
                        setFormErrors({ ...formErrors, needByDate: '' })
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (datePickerRef.current) {
                      datePickerRef.current.showPicker?.()
                    }
                  }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </button>
              </div>
              {formErrors.needByDate && (
                <div className="form-error">{formErrors.needByDate}</div>
              )}
            </div>
          </div>
          
          <button 
            className="submit-btn" 
            onClick={() => {
              if (validateForm()) {
                setShowImpactModal(true)
              }
            }}
          >
            zeff-iit!
          </button>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-label">Raised by you</div>
            <div className="stat-value">{tickets.raised.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Assigned to you</div>
            <div className="stat-value">{tickets.assigned.length}</div>
          </div>
          <div className="stat rating">
            <div className="stat-label">Avg Level (Last 7 Days)</div>
            <div className="stat-value">
              <span>{displayRating(avgRating)}</span>
            </div>
          </div>
        </div>

        {/* View Link Modal */}
        {showViewLinkModal && (
          <div className="modal" onClick={() => setShowViewLinkModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <span className="close" onClick={() => setShowViewLinkModal(false)}>&times;</span>
              <div className="modal-header">Impact Assessment</div>
              
              <div className="form-group">
                <label className="form-label">Uploaded Link</label>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(51, 65, 85, 0.4)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  wordBreak: 'break-all',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  marginBottom: '16px'
                }}>
                  <a 
                    href={viewLinkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: '#3b82f6',
                      textDecoration: 'none',
                      wordBreak: 'break-all'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {viewLinkUrl}
                  </a>
                </div>
                <button 
                  className="submit-btn" 
                  onClick={() => {
                    window.open(viewLinkUrl, '_blank')
                  }}
                >
                  Open Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Attachment Modal */}
        {showViewAttachmentModal && (
          <div className="modal" onClick={() => setShowViewAttachmentModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <span className="close" onClick={() => setShowViewAttachmentModal(false)}>&times;</span>
              <div className="modal-header">View Attachment</div>
              
              <div className="form-group">
                <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
                  <label className="form-label" style={{ position: 'sticky', top: 0, background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>Uploaded Attachment</label>
                  {viewAttachmentUrl && (
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(51, 65, 85, 0.4)',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '16px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      minHeight: '200px'
                    }}>
                      {!isValidFileUrl(viewAttachmentUrl) ? (
                        <div style={{ color: '#f87171', textAlign: 'center', padding: '20px' }}>
                          <p style={{ marginBottom: '12px', fontWeight: '600' }}>⚠️ Invalid Attachment URL</p>
                          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
                            The attachment URL appears to be a directory path, not a file. This file cannot be displayed.
                          </p>
                          <p style={{ color: '#64748b', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                            URL: {viewAttachmentUrl}
                          </p>
                        </div>
                      ) : (
                        <img 
                          src={getAbsoluteAttachmentUrl(viewAttachmentUrl)} 
                          alt="Attachment"
                          style={{
                            maxWidth: '100%',
                            borderRadius: '8px',
                            objectFit: 'contain'
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const parent = e.currentTarget.parentElement
                            if (parent) {
                              const absoluteUrl = getAbsoluteAttachmentUrl(viewAttachmentUrl)
                              parent.innerHTML = `
                                <div style="color: #94a3b8; text-align: center; padding: 20px;">
                                  <p style="margin-bottom: 12px;">Unable to load attachment. You can try opening the link directly:</p>
                                  <a href="${absoluteUrl}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none; word-break: break-all;">
                                    ${absoluteUrl}
                                  </a>
                                </div>
                              `
                            }
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <button 
                  className="submit-btn" 
                  onClick={() => {
                    if (viewAttachmentUrl && isValidFileUrl(viewAttachmentUrl)) {
                      const absoluteUrl = getAbsoluteAttachmentUrl(viewAttachmentUrl)
                      window.open(absoluteUrl, '_blank')
                    } else {
                      alert('Cannot open attachment: Invalid file URL. This appears to be a directory path, not a file.')
                    }
                  }}
                  disabled={!viewAttachmentUrl || !isValidFileUrl(viewAttachmentUrl)}
                  style={(!viewAttachmentUrl || !isValidFileUrl(viewAttachmentUrl)) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {viewAttachmentUrl && isValidFileUrl(viewAttachmentUrl) ? 'Open Attachment' : 'Cannot Open (Invalid URL)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Impact Modal */}
        {showImpactModal && (
          <div className="modal" onClick={() => setShowImpactModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <span className="close" onClick={() => setShowImpactModal(false)}>&times;</span>
              <div className="modal-header">Impact Assessment</div>
              
              <div className="form-group">
                <label className="form-label">Why is this important?</label>
                <select 
                  className="form-select" 
                  value={formData.businessImpact}
                  onChange={(e) => setFormData({...formData, businessImpact: e.target.value})}
                  required
                >
                  <option value="">Select impact type...</option>
                  <option value="Revenue">Revenue</option>
                  <option value="Cost">Cost</option>
                  <option value="Speed/Blocker/Efficiency/Productivity">Speed/Blocker/Efficiency/Productivity</option>
                  <option value="Experience/Reputation/Trust">Experience/Reputation/Trust</option>
                  <option value="Compliance/Legal">Compliance/Legal</option>
                  <option value="No Major Impact (Nice to Have)">No Major Impact (Nice to Have)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">How much impact?</label>
                <select 
                  className="form-select" 
                  value={formData.severityImpact}
                  onChange={(e) => setFormData({...formData, severityImpact: e.target.value})}
                  required
                >
                  <option value="">Select severity...</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div style={{marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                <div className="form-group">
                  <label className="form-label">Upload a Screenshot</label>
                  <input 
                    type="file" 
                    className="form-input" 
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setFormData({...formData, attachment: file})
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Upload a link</label>
                  <input 
                    type="url" 
                    className="form-input" 
                    value={formData.link}
                    onChange={(e) => setFormData({...formData, link: e.target.value})}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <button 
                className="submit-btn" 
                onClick={handleSubmitRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </div>
        )}

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'raised' ? 'active' : ''}`}
            onClick={() => setActiveTab('raised')}
          >
            Raised by me
          </button>
          <button 
            className={`tab ${activeTab === 'assigned' ? 'active' : ''}`}
            onClick={() => setActiveTab('assigned')}
          >
            Assigned to me
          </button>
          <button 
            className={`tab ${activeTab === 'self' ? 'active' : ''}`}
            onClick={() => setActiveTab('self')}
          >
            Assigned to self
          </button>
          <button 
            className={`tab ${activeTab === 'archived' ? 'active' : ''}`}
            onClick={() => setActiveTab('archived')}
          >
            Archived
          </button>
          <button 
            className={`tab ${activeTab === 'reporting_manager' ? 'active' : ''}`}
            onClick={() => setActiveTab('reporting_manager')}
          >
            Reportees
          </button>
        </div>

        {/* Ticket Lists */}
        <div className="list">
          {activeTab === 'raised' && (
            <div className="table-container cols-6-raised">
              <div className="table-header">
                <div>Issue / Request</div>
                <div>Deadline Status</div>
                <div>Severity</div>
                <div>Business Impact</div>
                <div>Assigned To</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              {tickets.raised.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  No tickets raised by you yet.
                </div>
              ) : (
                tickets.raised.map(ticket => (
                  <TicketRow 
                    key={ticket.name} 
                    ticket={ticket} 
                    isRaisedByMe={true}
                    context="raised"
                    onUpdateStatus={updateTicketStatus}
                    onAcceptTicket={acceptTicket}
                  />
                ))
              )}
            </div>
          )}
          
          
          
          {activeTab === 'assigned' && (
            <div className="table-container cols-7-assigned">
              <div className="table-header">
                <div>Issue / Request</div>
                <div>Deadline Status</div>
                <div>Severity</div>
                <div>Business Impact</div>
                <div>Assigned By</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              {tickets.assigned.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  No tickets assigned to you yet.
                </div>
              ) : (
                tickets.assigned.map(ticket => (
                  <TicketRow 
                    key={ticket.name} 
                    ticket={ticket} 
                    isRaisedByMe={false}
                    context="assigned"
                    onUpdateStatus={updateTicketStatus}
                    onAcceptTicket={acceptTicket}
                    onViewLink={(url) => {
                      setViewLinkUrl(url)
                      setShowViewLinkModal(true)
                    }}
                    onViewAttachment={(url) => {
                      setViewAttachmentUrl(url)
                      setShowViewAttachmentModal(true)
                    }}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'reporting_manager' && (
            <div className="table-container cols-7-reporting">
              <div className="table-header">
                <div>Issue / Request</div>
                <div>Deadline Status</div>
                <div>Severity</div>
                <div>Business Impact</div>
                <div>Raised By</div>
                <div>Assigned To</div>
                <div>Status</div>
              </div>
              {tickets.reportingManager.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  No tickets from your reportees.
                </div>
              ) : (
                tickets.reportingManager.map(ticket => (
                  <TicketRow 
                    key={ticket.name} 
                    ticket={ticket} 
                    isRaisedByMe={false}
                    context="reporting_manager"
                    onUpdateStatus={updateTicketStatus}
                    onAcceptTicket={acceptTicket}
                    onViewLink={(url) => {
                      setViewLinkUrl(url)
                      setShowViewLinkModal(true)
                    }}
                    onViewAttachment={(url) => {
                      setViewAttachmentUrl(url)
                      setShowViewAttachmentModal(true)
                    }}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'self' && (
            <div className="table-container cols-6-self">
              <div className="table-header">
                <div>Issue / Request</div>
                <div>Deadline Status</div>
                <div>Severity</div>
                <div>Business Impact</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              {tickets.selfAssigned.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  No tickets assigned to yourself yet.
                </div>
              ) : (
                tickets.selfAssigned.map(ticket => (
                  <TicketRow 
                    key={ticket.name} 
                    ticket={ticket} 
                    isRaisedByMe={true}
                    showAcceptedActions={true}
                    context="self"
                    onUpdateStatus={updateTicketStatus}
                    onAcceptTicket={acceptTicket}
                    onViewLink={(url) => {
                      setViewLinkUrl(url)
                      setShowViewLinkModal(true)
                    }}
                    onViewAttachment={(url) => {
                      setViewAttachmentUrl(url)
                      setShowViewAttachmentModal(true)
                    }}
                  />
                ))
              )}
            </div>
          )}
          {activeTab === 'archived' && (
            <div className="table-container cols-7">
              <div className="table-header">
                <div>Issue / Request</div>
                <div>Deadline Status</div>
                <div>Severity</div>
                <div>Business Impact</div>
                <div>Status</div>
                <div>Rating</div>
                <div>Notes</div>
              </div>
              {tickets.archived.length === 0 ? (
                <div className="no-tickets">No archived issues.</div>
              ) : (
                tickets.archived.map(ticket => {
                  // Determine notes to display: prefer Accepted action notes, otherwise latest non-empty notes
                  const acceptedNotes = ticket.action_status?.find(action => action.status === "Accepted")?.notes || ""
                  let latestNotes = acceptedNotes
                  if (!latestNotes && ticket.action_status && ticket.action_status.length > 0) {
                    const withNotes = ticket.action_status
                      .filter(a => (a.notes || '').trim().length > 0)
                      .sort((a, b) => new Date(b.status_update_latest_time).getTime() - new Date(a.status_update_latest_time).getTime())
                    if (withNotes.length > 0) {
                      latestNotes = withNotes[0].notes
                    }
                  }

                  // Find the latest rating from action_status (convert 0-1 scale to 1-5 if needed)
                  let latestRating = 0
                  if (ticket.action_status && ticket.action_status.length > 0) {
                    const ratedActions = ticket.action_status
                      .filter(a => typeof a.rating === 'number' && (a.rating as number) > 0)
                      .sort((a, b) => new Date(b.status_update_latest_time).getTime() - new Date(a.status_update_latest_time).getTime())
                    if (ratedActions.length > 0) {
                      const r = ratedActions[0].rating as number
                      latestRating = r >= 0 && r <= 1 ? r * 5 : r
                    }
                  }
                  const ratingDisplay = latestRating ? getLevelFromRating(latestRating) : '-'
                  
                  return (
                    <div className="row" key={ticket.name}>
                      <div>
                        <div className="ticket-title">{ticket.what_is_issueidea}</div>
                        <div className="ticket-id">#{ticket.name}</div>
                      </div>
                      <div className="cell-content">
                        <div className={`deadline-status ${calculateDeadlineStatus(ticket).class}`}>
                          {calculateDeadlineStatus(ticket).text}
                        </div>
                      </div>
                      <div className="cell-content">{ticket.severity_business_impact}</div>
                      <div className="cell-content">{ticket.business_impact}</div>
                      <div className="pill" data-status="Accepted">Accepted</div>
                      <div className="cell-content">{ratingDisplay}</div>
                      <div className="cell-content">{latestNotes || "-"}</div>
                    </div>
                  )
                })
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// TicketRow component would be implemented here
function TicketRow({ 
  ticket, 
  isRaisedByMe, 
  showAcceptedActions = false, 
  onUpdateStatus, 
  onAcceptTicket,
  context,
  onViewLink,
  onViewAttachment
}: {
  ticket: Ticket
  isRaisedByMe: boolean
  showAcceptedActions?: boolean
  onUpdateStatus: (ticketName: string, status: string, notes: string) => void
  onAcceptTicket: (ticketName: string, level: string, notes: string) => void
  context?: 'raised' | 'assigned' | 'self' | 'archived' | 'reporting_manager'
  onViewLink?: (url: string) => void
  onViewAttachment?: (url: string) => void
}) {
  const [showUpdate, setShowUpdate] = useState(false)
  const [showAccept, setShowAccept] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(ticket.status)
  const [updateNotes, setUpdateNotes] = useState(ticket.notes || '')
  const [acceptNotes, setAcceptNotes] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')

  const deadlineStatus = calculateDeadlineStatus(ticket)
  const status = ticket.status || "Created"
  const showAcceptButton = isRaisedByMe && (status === "Completed" || status === "In progress")
  const showUpdateButton = status !== "Accepted" || showAcceptedActions
  const showAcceptButtonSelf = showAcceptedActions && status === "Completed"
  const hasLink = !!(ticket.link && ticket.link.trim())
  const hasAttachment = !!(ticket.attachment && ticket.attachment.trim())

  const handleUpdateSubmit = () => {
    onUpdateStatus(ticket.name, updateStatus, updateNotes)
    setShowUpdate(false)
  }

  const handleAcceptSubmit = () => {
    if (!selectedLevel) {
      alert("Please select a level before accepting.")
      return
    }
    onAcceptTicket(ticket.name, selectedLevel, acceptNotes)
    setShowAccept(false)
  }

  // Helper function to handle link view
  const handleViewLink = async () => {
    if (onViewLink) {
      if (ticket.link && ticket.link.trim()) {
        onViewLink(ticket.link.trim())
        return
      }
      try {
        const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.name)}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (!data?.ticket) {
            alert('Unable to load ticket details.')
            return
          }
          const fetchedTicketObj = data.ticket.data || data.ticket
          const link = fetchedTicketObj?.link || data.ticket.link || null
          if (link && typeof link === 'string' && link.trim()) {
            onViewLink(link.trim())
            return
          }
          // Fallback: Try extracting a URL from notes
          const candidateFromNotes = (fetchedTicketObj?.notes || '').match(/https?:\/\/[^\s)]+/i)
          if (candidateFromNotes && candidateFromNotes[0]) {
            onViewLink(candidateFromNotes[0])
            return
          }
          // Fallback: Try action_status notes (newest first)
          const actions = Array.isArray(fetchedTicketObj?.action_status) ? fetchedTicketObj.action_status : []
          const sortedDesc = [...actions].sort((a: any, b: any) => new Date(b.status_update_latest_time || 0).getTime() - new Date(a.status_update_latest_time || 0).getTime())
          for (const act of sortedDesc) {
            const cand = (act?.notes || '').match(/https?:\/\/[^\s)]+/i)
            if (cand && cand[0]) {
              onViewLink(cand[0])
              return
            }
          }
          alert('No link available for this ticket.')
        } else {
          const errorText = await res.text().catch(() => 'Unknown error')
          console.error('Error fetching ticket:', res.status, errorText)
          alert('Unable to load ticket details to view the link.')
        }
      } catch (error) {
        console.error('Error fetching ticket:', error)
        alert('Unable to load ticket details to view the link.')
      }
    }
  }

  // Helper function to handle attachment view
  const handleViewAttachment = async () => {
    if (onViewAttachment) {
      if (ticket.attachment && ticket.attachment.trim()) {
        onViewAttachment(ticket.attachment.trim())
        return
      }
      try {
        const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.name)}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const fetchedTicketObj = data.ticket.data || data.ticket
          const attachment = fetchedTicketObj?.attachment || data.ticket.attachment || null
          if (attachment && typeof attachment === 'string' && attachment.trim()) {
            onViewAttachment(attachment.trim())
            return
          }
          const filesRes = await fetch(`/api/tickets/${encodeURIComponent(ticket.name)}/attachments`, { credentials: 'include' })
          if (filesRes.ok) {
            const filesData = await filesRes.json()
            const attachments = Array.isArray(filesData?.attachments) ? filesData.attachments : []
            if (attachments.length > 0 && attachments[0].url) {
              onViewAttachment(attachments[0].url)
              return
            }
          }
          alert('No attachment available for this ticket.')
        }
      } catch (error) {
        console.error('Error fetching ticket:', error)
        alert('Unable to load ticket details to view the attachment.')
      }
    }
  }

  return (
    <div className="row" id={`row-${ticket.name}`}>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <div className="ticket-title">{ticket.what_is_issueidea || "No description"}</div>
            <div className="ticket-id">#{ticket.name}</div>
          </div>
          {(hasLink || hasAttachment) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              {hasLink && (
                <button 
                  className="btn-icon"
                  onClick={handleViewLink}
                  title="View link"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </button>
              )}
              {hasAttachment && (
                <button 
                  className="btn-icon"
                  onClick={handleViewAttachment}
                  title="View attachment"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
                    <circle cx="11" cy="11" r="1" fill="white"></circle>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="cell-content">
        <div className={`deadline-status ${deadlineStatus.class}`}>{deadlineStatus.text}</div>
      </div>
      <div className="cell-content">{ticket.severity_business_impact || "Not specified"}</div>
      <div className="cell-content">{ticket.business_impact || "Not specified"}</div>
      {context === 'raised' && (
        <div className="cell-content">{ticket.assigned_to_user || "Unassigned"}</div>
      )}
      {context === 'assigned' && (
        <div className="cell-content">{ticket.raised_by || "-"}</div>
      )}
      {context === 'reporting_manager' && (
        <>
          <div className="cell-content">{ticket.raised_by || "-"}</div>
          <div className="cell-content">{ticket.assigned_to_user || "Unassigned"}</div>
        </>
      )}
      <div className="pill" data-status={status} id={`pill-${ticket.name}`}>{status}</div>
      {context !== 'reporting_manager' && (
        <div className="actions" data-context={context}>
          {showUpdateButton && (
            <button className="btn primary" onClick={() => setShowUpdate(true)}>Update</button>
          )}
          {(showAcceptButton || showAcceptButtonSelf) && (
            <button className="btn accept" onClick={() => setShowAccept(true)}>Accept</button>
          )}
        </div>
      )}
      
      {showUpdate && (
        <div className="inline-update">
          <select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)}>
            <option value="Created">Created</option>
            <option value="In progress">In progress</option>
            <option value="Completed">Completed</option>
            <option value="Discarded">Discarded</option>
          </select>
          <textarea 
            value={updateNotes} 
            onChange={(e) => setUpdateNotes(e.target.value)}
            placeholder="Add notes about this status update..."
          />
          <button className="btn secondary" onClick={handleUpdateSubmit}>Save Changes</button>
          <button className="btn cancel" onClick={() => setShowUpdate(false)}>Cancel</button>
        </div>
      )}
      
      {showAccept && (
        <div className="inline-accept">
          <div className="rating-container">
            <div className="rating-label">Select Level (L1-L5):</div>
            <div className="level-buttons">
              {['L1', 'L2', 'L3', 'L4', 'L5'].map(level => (
                <div 
                  key={level}
                  className={`level-btn ${selectedLevel === level ? 'active' : ''}`}
                  onClick={() => setSelectedLevel(level)}
                >
                  {level}
                </div>
              ))}
            </div>
          </div>
          <textarea 
            value={acceptNotes} 
            onChange={(e) => setAcceptNotes(e.target.value)}
            placeholder="Add acceptance notes..."
          />
          <button className="btn accept" onClick={handleAcceptSubmit}>Accept & Rate</button>
          <button className="btn cancel" onClick={() => setShowAccept(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function calculateDeadlineStatus(ticket: Ticket) {
  const today = new Date()
  const expectedDate = new Date(ticket.when_do_i_need_this_by + 'T00:00:00')
  const diffTime = expectedDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (ticket.status === "Accepted") {
    const completionDate = new Date(ticket.status_update_latest_time)
    const completionDiffTime = expectedDate.getTime() - completionDate.getTime()
    const completionDiffDays = Math.ceil(completionDiffTime / (1000 * 60 * 60 * 24))
    
    if (completionDiffDays > 0) {
      return {
        text: `Done ${completionDiffDays} day${completionDiffDays > 1 ? 's' : ''} before expected`,
        class: 'completed-early'
      }
    } else if (completionDiffDays === 0) {
      return {
        text: 'Done within timeframe',
        class: 'completed-ontime'
      }
    } else {
      return {
        text: `Delayed by ${Math.abs(completionDiffDays)} day${Math.abs(completionDiffDays) > 1 ? 's' : ''}`,
        class: 'completed-late'
      }
    }
  }

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} overdue`,
      class: 'overdue'
    }
  } else if (diffDays <= 3) {
    return {
      text: `${diffDays} day${diffDays > 1 ? 's' : ''} left`,
      class: 'urgent'
    }
  } else {
    return {
      text: `${diffDays} days left`,
      class: 'normal'
    }
  }
}  