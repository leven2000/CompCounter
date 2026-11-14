import { headers } from 'next/headers'

export async function baseUrl() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? (local ? 'http' : 'https')
  return `${proto}://${host}`
}
