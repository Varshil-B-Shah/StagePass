'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface NavbarProps {
  userId?: string | null
}

export function Navbar({ userId }: NavbarProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <nav className="border-b px-6 py-3 flex items-center justify-between">
      <Link href="/" className="font-bold text-lg">StagePass</Link>
      <div className="flex items-center gap-3">
        {userId ? (
          <Button variant="outline" size="sm" onClick={handleLogout}>Sign Out</Button>
        ) : (
          <Button asChild size="sm">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        )}
      </div>
    </nav>
  )
}
