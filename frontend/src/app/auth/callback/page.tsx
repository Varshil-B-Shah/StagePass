'use client'
import { useEffect } from 'react'

export default function AuthCallbackPage() {
  useEffect(() => {
    // Phase 1 stub: just redirect home.
    // Phase 2 will exchange the `?code=` for tokens and set the httpOnly cookie.
    window.location.replace('/')
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center text-gray-500">
      Signing you in…
    </div>
  )
}
