import fetchMock from 'jest-fetch-mock'

fetchMock.enableMocks()

// jest-fetch-mock replaces global.Response with cross-fetch's Response which lacks
// the static .json() method. Restore it so NextResponse.json() works in tests.
if (typeof (global.Response as unknown as Record<string, unknown>)['json'] !== 'function') {
  ;(global.Response as unknown as Record<string, unknown>)['json'] = function (
    data: unknown,
    init?: ResponseInit
  ) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    })
  }
}
