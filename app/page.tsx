'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  // Check if already logged in
  useEffect(() => {
    setMounted(true)
    checkAuthStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/check", { 
        credentials: "include" 
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data && data.message && data.message !== "Guest") {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      // User needs to login - ignore errors
      console.error('Auth check failed:', error)
    }
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="zeff-login-container">
        <div className="zeff-login-card">
          <h1 className="zeff-login-title">Loading...</h1>
        </div>
      </div>
    )
  }

  const login = async (email: string, password: string) => {
    const payload = new URLSearchParams({ usr: email, pwd: password })
    
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      credentials: "include",
      body: payload.toString()
    })

    let data = null
    try { 
      data = await response.json() 
    } catch (_) {}

    if (!response.ok) {
      const text = (data && (data.exc || data.message)) ? JSON.stringify(data) : "Login failed."
      throw new Error(text)
    }

    if (data && (data.message === "Logged In" || data.sid || data.full_name)) {
      return true
    }

    if (response.headers.get("content-type") && response.headers.get("content-type")?.includes("text/html")) {
      return true
    }

    if (data && data.message) {
      if (typeof data.message === "string" && data.message.toLowerCase().includes("otp")) {
        throw new Error("Two-factor authentication is enabled. Please complete OTP on the standard /login page.")
      }
      throw new Error(data.message)
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!email || !password) {
      setMessage("Please enter both username/email and password.")
      return
    }

    setLoading(true)

    try {
      await login(email, password)
      
      // Handle remember me
      if (remember) {
        try { 
          localStorage.setItem("zeff_remember", "1") 
        } catch (_) {}
      } else {
        try { 
          localStorage.removeItem("zeff_remember") 
        } catch (_) {}
      }

      setMessage("Signed in. Redirecting…")
      router.push('/dashboard')
    } catch (err: any) {
      let text = (err && err.message) ? err.message : "Login failed. Please try again."
      
      if (text.startsWith("{")) {
        try {
          const parsed = JSON.parse(text)
          text = parsed._server_messages
            ? JSON.parse(parsed._server_messages)[0]
            : (parsed.message || "Login failed.")
        } catch (_) { }
      }
      
      setMessage(text)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="zeff-login-container">
      <div className="zeff-login-card">
        <h1 className="zeff-login-title">Sign in to Zeff</h1>
        <p className="zeff-login-sub">Use your email and password to continue.</p>

        <form onSubmit={handleSubmit} className="zeff-login-form">
          <label htmlFor="email" className="zeff-label">Username or Email</label>
          <input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Username or Email"
            autoComplete="username"
            required
            className="zeff-input"
          />

          <label htmlFor="password" className="zeff-label">Password</label>
          <div className="zeff-password-container">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="zeff-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="zeff-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          <div className="zeff-row">
            <label className="zeff-checkbox-label">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="zeff-checkbox"
              />
              <span>Stay signed in</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="zeff-btn"
          >
            {loading ? (
              <>
                <div className="zeff-spinner"></div>
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {message && (
            <div className={`zeff-message ${
              message.includes('error') || message.includes('failed') || message.includes('Invalid')
                ? 'zeff-message-error' 
                : 'zeff-message-info'
            }`}>
              {message}
            </div>
          )}
        </form>

        <div className="zeff-footer">
        </div>
      </div>
    </div>
  )
}
