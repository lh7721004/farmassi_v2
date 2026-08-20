import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from './config.ts'

/** HS256 JWT. 라이브러리를 쓰지 않는다 — 서명/검증 두 가지만 필요하다. */

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export interface SessionClaims {
  sub: string
  role: 'authenticated'
  exp: number
}

export function sign(payload: Omit<SessionClaims, 'exp'>, days = config.sessionDays): string {
  const exp = Math.floor(Date.now() / 1000) + days * 86400
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify({ ...payload, exp }))
  const signature = createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

export function verify(token: string): SessionClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts

  const expected = createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionClaims
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null
    if (typeof claims.sub !== 'string' || !claims.sub) return null
    return claims
  } catch {
    return null
  }
}
