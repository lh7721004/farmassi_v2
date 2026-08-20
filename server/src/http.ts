import type { IncomingMessage, ServerResponse } from 'node:http'
import { verify } from './jwt.ts'
import { config } from './config.ts'

export interface Ctx {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  userId: string | null
  body: any
}

export function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

export function cors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin
  // 브라우저가 자격증명을 보내야 하므로 * 를 쓸 수 없다. 허용한 출처만 그대로 돌려준다.
  if (origin && (origin === config.siteOrigin || origin.startsWith('http://localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
}

export function userFrom(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return verify(header.slice(7))?.sub ?? null
}

const MAX_BODY = 2 * 1024 * 1024

export async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error('요청 본문이 너무 큽니다.')
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('JSON 을 해석할 수 없습니다.')
  }
}
