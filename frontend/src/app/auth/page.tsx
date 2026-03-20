'use client'

const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
const CALLBACK_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/auth/callback`
  : ''

function cognitoSignInUrl() {
  return (
    `${COGNITO_DOMAIN}/login` +
    `?client_id=${COGNITO_CLIENT_ID}` +
    `&response_type=code` +
    `&scope=email+openid+profile` +
    `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`
  )
}

export default function AuthPage() {
  const isDev = process.env.NODE_ENV !== 'production'

  const handleDevSignIn = async () => {
    await fetch('/api/dev/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub: 'dev-user-001', email: 'dev@stagepass.local' }),
    })
    window.location.href = '/'
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow">
        <h1 className="text-xl font-bold mb-6 text-center">Sign in to StagePass</h1>

        {isDev ? (
          <button
            onClick={handleDevSignIn}
            className="w-full rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
          >
            Dev sign-in (local only)
          </button>
        ) : (
          <a
            href={cognitoSignInUrl()}
            className="block w-full rounded bg-indigo-600 px-4 py-2 text-center text-white hover:bg-indigo-700"
          >
            Sign in with Cognito
          </a>
        )}
      </div>
    </main>
  )
}
