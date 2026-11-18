import { timingSafeEqual } from 'node:crypto'
import { DESKTOP } from './desktop'

export function fromDesktopApp(req: Request) {
  const expected = process.env.COMPCOUNTER_DESKTOP_KEY ?? ''
  const given = req.headers.get('x-compcounter-key') ?? ''
  if (!DESKTOP || expected.length < 32 || given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}
