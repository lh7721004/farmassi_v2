import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { config } from './config.ts'
import { withAdmin } from './db.ts'
import { sign } from './jwt.ts'

/**
 * 카카오 로그인.
 *
 * 흐름: /auth/kakao/start → 카카오 동의화면 → /auth/kakao/callback
 *      → 우리 세션 토큰을 만들어 프론트로 ?code=<토큰> 으로 돌려보낸다.
 *
 * 프론트의 AuthCallback 이 원래 `?code=` 를 받아 세션으로 바꾸던 코드를 그대로 쓴다.
 */

const AUTHORIZE = 'https://kauth.kakao.com/oauth/authorize'
const TOKEN = 'https://kauth.kakao.com/oauth/token'
const PROFILE = 'https://kapi.kakao.com/v2/user/me'

/** 돌아갈 주소를 서명해서 state 에 싣는다. 위조된 주소로 튕겨나가지 않게 하려는 것. */
function packState(redirect: string): string {
  const payload = Buffer.from(redirect).toString('base64url')
  const mac = createHmac('sha256', config.jwtSecret).update(payload).digest('base64url')
  return `${payload}.${mac}`
}

function unpackState(state: string): string | null {
  const [payload, mac] = state.split('.')
  if (!payload || !mac) return null
  const expected = createHmac('sha256', config.jwtSecret).update(payload).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return Buffer.from(payload, 'base64url').toString('utf8')
}

/** 우리 사이트로만 돌려보낸다. 열린 리다이렉트 방지. */
function safeRedirect(raw: string | null): string {
  const fallback = `${config.siteOrigin}/auth/callback`
  if (!raw) return fallback
  try {
    const url = new URL(raw)
    const allowed = config.siteOrigins.includes(url.origin) || url.hostname === 'localhost'
    return allowed ? url.toString() : fallback
  } catch {
    return fallback
  }
}

export function kakaoStart(res: ServerResponse, redirect: string | null): void {
  const params = new URLSearchParams({
    client_id: config.kakao.clientId,
    redirect_uri: config.kakao.redirectUri,
    response_type: 'code',
    scope: 'profile_nickname profile_image',
    state: packState(safeRedirect(redirect)),
  })
  res.writeHead(302, { Location: `${AUTHORIZE}?${params}` }).end()
}

export async function kakaoCallback(
  res: ServerResponse, code: string | null, state: string | null,
): Promise<void> {
  const redirect = state ? unpackState(state) : null
  const target = safeRedirect(redirect)

  const bail = (message: string) => {
    const url = new URL(target)
    url.searchParams.set('error_description', message)
    res.writeHead(302, { Location: url.toString() }).end()
  }

  if (!code) return bail('인가 코드가 없습니다.')

  try {
    const tokenRes = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.kakao.clientId,
        redirect_uri: config.kakao.redirectUri,
        code,
        ...(config.kakao.clientSecret ? { client_secret: config.kakao.clientSecret } : {}),
      }),
    })
    const tokenBody = await tokenRes.json() as { access_token?: string; error_description?: string }
    if (!tokenBody.access_token) return bail(tokenBody.error_description ?? '카카오 토큰 발급에 실패했습니다.')

    const profileRes = await fetch(PROFILE, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    })
    const profile = await profileRes.json() as {
      id?: number
      kakao_account?: { email?: string; profile?: { nickname?: string; profile_image_url?: string } }
    }
    if (!profile.id) return bail('카카오 프로필을 가져오지 못했습니다.')

    const kakaoId = String(profile.id)
    const nickname = profile.kakao_account?.profile?.nickname ?? `사용자${kakaoId.slice(-4)}`
    const avatar = profile.kakao_account?.profile?.profile_image_url ?? null
    const email = profile.kakao_account?.email ?? null

    const userId = await withAdmin(async (db) => {
      const found = await db.query(
        `select user_id from auth.identities where provider = 'kakao' and provider_user_id = $1`,
        [kakaoId],
      )
      if (found.rows[0]) {
        // 닉네임/사진이 바뀌었을 수 있으니 갱신한다.
        await db.query(
          `update public.profiles set display_name = $2, avatar_url = coalesce($3, avatar_url)
             where id = $1`,
          [found.rows[0].user_id, nickname, avatar],
        )
        return found.rows[0].user_id as string
      }

      // auth.users 에 넣으면 트리거가 public.profiles 를 만든다.
      const created = await db.query(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1, $2) returning id`,
        [email, JSON.stringify({ nickname, avatar_url: avatar, provider: 'kakao' })],
      )
      const id = created.rows[0].id as string
      await db.query(
        `insert into auth.identities (provider, provider_user_id, user_id) values ('kakao', $1, $2)`,
        [kakaoId, id],
      )
      return id
    })

    const url = new URL(target)
    url.searchParams.set('code', sign({ sub: userId, role: 'authenticated' }))
    res.writeHead(302, { Location: url.toString() }).end()
  } catch (error) {
    bail(error instanceof Error ? error.message : '로그인에 실패했습니다.')
  }
}
