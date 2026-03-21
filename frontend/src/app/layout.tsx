import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { Navbar } from '@/components/Navbar'
import { cookies } from 'next/headers'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'StagePass',
  description: 'Real-time seat booking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const isLoggedIn = cookieStore.has('access_token')

  return (
    <html lang="en" className={cn('font-sans', inter.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Navbar userId={isLoggedIn ? 'user' : null} />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
