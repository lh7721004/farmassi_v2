/**
 * 원본 백엔드(Supabase PostgREST)와 자체 API 의 응답을 대조한다.
 * 익명 접근 범위에서, 양쪽에 동일하게 존재하는 데이터로 비교한다.
 */
const SB_URL = 'https://pfysjhabkqwfytzpsbom.supabase.co'
const SB_KEY = process.env.SUPABASE_ANON_KEY!
const API = 'https://api.shop.lkim.me'

const MINE_ONLY = new Set(['is_listed', 'bankda_merchant_email', 'external_id'])

async function viaSupabase(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  })
  return r.json()
}
async function viaOurs(body: unknown) {
  const r = await fetch(`${API}/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return (await r.json()).data
}

/** 내가 추가한 컬럼은 빼고, 키를 정렬해 비교 가능한 형태로 만든다. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as object).sort()) {
      if (MINE_ONLY.has(k)) continue
      out[k] = normalize((value as any)[k])
    }
    return out
  }
  return value
}

let pass = 0, fail = 0
function compare(label: string, a: unknown, b: unknown) {
  const x = JSON.stringify(normalize(a)), y = JSON.stringify(normalize(b))
  const ok = x === y
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) {
    console.log(`        원본: ${x.slice(0, 260)}`)
    console.log(`        자체: ${y.slice(0, 260)}`)
  }
}

const SLUG = 'jinyeongnongwon'

compare('농가 단건 (slug)',
  (await viaSupabase(`farms?slug=eq.${SLUG}&select=*`))[0],
  await viaOurs({ table: 'farms', select: '*', filters: [{ column: 'slug', op: 'eq', value: SLUG }], single: 'maybe' }))

const farmId = (await viaSupabase(`farms?slug=eq.${SLUG}&select=id`))[0].id

compare('상품 목록 (정렬)',
  await viaSupabase(`products?farm_id=eq.${farmId}&select=*&order=sort_order.asc`),
  await viaOurs({ table: 'products', select: '*', filters: [{ column: 'farm_id', op: 'eq', value: farmId }], order: [{ column: 'sort_order' }] }))

compare('컬럼 일부만 선택',
  await viaSupabase(`farms?slug=eq.${SLUG}&select=name,slug,location,bank_name`),
  await viaOurs({ table: 'farms', select: 'name, slug, location, bank_name', filters: [{ column: 'slug', op: 'eq', value: SLUG }] }))

compare('in 필터',
  await viaSupabase(`farms?slug=in.(${SLUG},sigolnongwon)&select=name,slug&order=slug.asc`),
  await viaOurs({ table: 'farms', select: 'name, slug', filters: [{ column: 'slug', op: 'in', value: [SLUG, 'sigolnongwon'] }], order: [{ column: 'slug' }] }))

compare('limit (같은 농가로 한정)',
  await viaSupabase(`products?farm_id=eq.${farmId}&select=name&order=name.asc&limit=3`),
  await viaOurs({ table: 'products', select: 'name', filters: [{ column: 'farm_id', op: 'eq', value: farmId }], order: [{ column: 'name' }], limit: 3 }))

compare('시각 형식 (timestamptz)',
  await viaSupabase(`farms?slug=eq.${SLUG}&select=created_at,updated_at`),
  await viaOurs({ table: 'farms', select: 'created_at, updated_at', filters: [{ column: 'slug', op: 'eq', value: SLUG }] }))

compare('null 처리',
  await viaSupabase(`farms?slug=eq.${SLUG}&select=description,map_url,kakao_channel_url`),
  await viaOurs({ table: 'farms', select: 'description, map_url, kakao_channel_url', filters: [{ column: 'slug', op: 'eq', value: SLUG }] }))

compare('jsonb 컬럼',
  await viaSupabase(`farms?slug=eq.${SLUG}&select=landing_blocks`),
  await viaOurs({ table: 'farms', select: 'landing_blocks', filters: [{ column: 'slug', op: 'eq', value: SLUG }] }))

compare('정렬 내림차순',
  await viaSupabase(`products?farm_id=eq.${farmId}&select=name,price&order=price.desc`),
  await viaOurs({ table: 'products', select: 'name, price', filters: [{ column: 'farm_id', op: 'eq', value: farmId }], order: [{ column: 'price', ascending: false }] }))

compare('RLS 로 막힌 테이블 (익명)',
  await viaSupabase(`orders?select=id`),
  await viaOurs({ table: 'orders', select: 'id' }))

compare('없는 행 조회',
  await viaSupabase(`farms?slug=eq.__none__&select=*`),
  await viaOurs({ table: 'farms', select: '*', filters: [{ column: 'slug', op: 'eq', value: '__none__' }] }))

console.log(`\n  ${pass}/${pass + fail} 일치`)
process.exit(fail ? 1 : 0)
