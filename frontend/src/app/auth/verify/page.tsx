'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function VerifyForm() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get('email') || ''
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    if (res.ok) {
      router.push('/auth/login')
    } else {
      const data = await res.json()
      setError(data.error || 'Verification failed')
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle>Verify Email</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Enter the code sent to {email}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-1">
            <Label htmlFor="code">Verification Code</Label>
            <Input id="code" type="text" value={code} onChange={e => setCode(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full">Verify</Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Suspense><VerifyForm /></Suspense>
    </main>
  )
}
