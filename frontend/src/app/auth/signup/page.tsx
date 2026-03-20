'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      router.push(`/auth/verify?email=${encodeURIComponent(form.email)}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Signup failed')
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Create Account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" type="text" value={form.firstName} onChange={set('firstName')} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" type="text" value={form.lastName} onChange={set('lastName')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password (8+ chars)</Label>
              <Input id="password" type="password" value={form.password} onChange={set('password')} required />
            </div>
            <Button type="submit" className="w-full">Create Account</Button>
            <p className="text-sm text-center">
              <a href="/auth/login" className="text-primary underline">Already have an account?</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
