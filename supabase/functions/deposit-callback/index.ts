import { adminClient, corsHeaders, json } from '../_shared/http.ts'
import {
  ingestDeposit,
  paramsToObject,
  parseIncomingDeposits,
  parseProvider,
} from '../_shared/depositMatch.ts'

function callbackToken() {
  return Deno.env.get('DEPOSIT_CALLBACK_TOKEN')?.trim() ?? ''
}

function requestToken(req: Request, url: URL) {
  const header =
    req.headers.get('x-callback-token') ??
    req.headers.get('x-api-key') ??
    ''
  const bearer = req.headers.get('authorization')
  const bearerToken = bearer?.toLowerCase().startsWith('bearer ') ? bearer.slice(7).trim() : ''
  return url.searchParams.get('token') ?? url.searchParams.get('key') ?? header.trim() ?? bearerToken
}

function isAuthorized(req: Request, url: URL) {
  const expected = callbackToken()
  if (!expected) return false
  return requestToken(req, url) === expected
}

function isForm(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''
  return contentType.includes('application/x-www-form-urlencoded')
}

function pingResponse(form: boolean) {
  if (form) return new Response('OK', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } })
  return json({ ok: true, service: 'farmassi-deposit-callback' })
}

async function readPayload(req: Request, url: URL): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const params = paramsToObject(url.searchParams)
    return Object.keys(params).length > 0 ? params : null
  }

  const text = await req.text()
  if (!text.trim()) {
    const params = paramsToObject(url.searchParams)
    return Object.keys(params).length > 0 ? params : null
  }

  if (isForm(req)) {
    return paramsToObject(new URLSearchParams(text))
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return paramsToObject(new URLSearchParams(text))
  }
}

function oauthHtml() {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>연동 완료</title>
<p>거래내역 조회 연동이 완료되었습니다. 이 창을 닫아도 됩니다.</p>`,
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!['GET', 'POST', 'HEAD'].includes(req.method)) return json({ error: '허용되지 않은 요청입니다.' }, 405)

  const url = new URL(req.url)

  if (req.method === 'GET' && url.searchParams.has('code')) return oauthHtml()

  if (req.method === 'HEAD') return new Response(null, { status: 200, headers: corsHeaders })

  if (req.method === 'GET' && ![...url.searchParams.keys()].some((key) => !['token', 'key', 'apikey', 'provider'].includes(key))) {
    return pingResponse(false)
  }

  if (!isAuthorized(req, url)) {
    if (req.method === 'GET') return pingResponse(false)
    return json({ error: '콜백 토큰이 필요합니다.' }, 401)
  }

  try {
    const payload = await readPayload(req, url)
    const deposits = parseIncomingDeposits(payload)
    if (deposits.length === 0) return pingResponse(isForm(req))

    const admin = adminClient()
    const provider = parseProvider(url.searchParams.get('provider'))
    const results = []
    for (const deposit of deposits) {
      results.push(await ingestDeposit(admin, provider, deposit))
    }

    if (isForm(req)) {
      return new Response('OK', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } })
    }

    return json({
      ok: true,
      received: deposits.length,
      saved: results.filter((item) => item.saved).length,
      matched: results.filter((item) => item.matched).length,
      skipped: results.filter((item) => item.skipped).length,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '거래내역 처리에 실패했습니다.'
    if (isForm(req)) {
      return new Response('FAIL', { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } })
    }
    return json({ error: message }, 500)
  }
})
