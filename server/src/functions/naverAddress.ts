import { fail, ok, type FnHandler } from './types.ts'

// supabase/functions/naver-address/index.ts 를 그대로 옮긴 것.
// DB 를 쓰지 않고 카카오 주소 API 만 호출한다.


interface AddressCandidate {
  id: string
  name: string
  address: string
  zonecode: string
  lat: number
  lng: number
}

interface SearchBody {
  action: 'search'
  query: string
}

interface ReverseBody {
  action: 'reverse'
  lat: number
  lng: number
}

type Body = SearchBody | ReverseBody

interface KakaoRoadAddress {
  address_name?: string
  zone_no?: string
  building_name?: string
  x?: string
  y?: string
}

interface KakaoAddressDocument {
  address_name?: string
  address_type?: string
  x?: string
  y?: string
  address?: { address_name?: string } | null
  road_address?: KakaoRoadAddress | null
}

interface KakaoKeywordDocument {
  place_name?: string
  address_name?: string
  road_address_name?: string
  x?: string
  y?: string
}

interface KakaoSearchMeta {
  total_count?: number
  pageable_count?: number
  is_end?: boolean
}

interface KakaoCoordDocument {
  address?: { address_name?: string; zone_no?: string }
  road_address?: { address_name?: string; zone_no?: string; building_name?: string }
}

function kakaoHeaders() {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) throw new Error('카카오 REST API 키(KAKAO_REST_API_KEY)가 설정되지 않았습니다.')
  return {
    Accept: 'application/json',
    Authorization: `KakaoAK ${key}`,
  }
}

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function withSpaceBeforeNumber(value: string) {
  return value.replace(/([가-힣A-Za-z]+)(\d[\d-]*)$/, '$1 $2')
}

function roadOnlyKeyword(value: string) {
  return value.replace(/\s*\d[\d-]*$/, '').trim()
}

function buildSearchQueries(input: string) {
  const normalized = normalizeKeyword(input)
  const spaced = normalizeKeyword(withSpaceBeforeNumber(normalized))
  const roadOnly = normalizeKeyword(roadOnlyKeyword(spaced))
  const hasTrailingNumber = /\d[\d-]*$/.test(spaced)
  const queries = [normalized]

  if (spaced && spaced !== normalized) queries.push(spaced)
  if (hasTrailingNumber && roadOnly.length >= 2 && roadOnly !== normalized && roadOnly !== spaced) {
    queries.push(roadOnly)
  }

  return [...new Set(queries)]
}

function toCandidate(
  address: string,
  lat: number,
  lng: number,
  zonecode: string,
  name?: string,
): AddressCandidate | null {
  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    id: `addr:${lng},${lat},${address}`,
    name: name?.trim() || address,
    address,
    zonecode,
    lat,
    lng,
  }
}

function fromAddressDocument(doc: KakaoAddressDocument): AddressCandidate | null {
  const road = doc.road_address
  const address = road?.address_name || doc.address_name || doc.address?.address_name || ''
  const lat = Number(road?.y ?? doc.y)
  const lng = Number(road?.x ?? doc.x)
  const zonecode = road?.zone_no ?? ''
  const name = road?.building_name?.trim() || address
  return toCandidate(address, lat, lng, zonecode, name)
}

function fromKeywordDocument(doc: KakaoKeywordDocument): AddressCandidate | null {
  const address = doc.road_address_name || doc.address_name || ''
  const lat = Number(doc.y)
  const lng = Number(doc.x)
  const name = doc.place_name?.trim() || address
  return toCandidate(address, lat, lng, '', name)
}

/**
 * 카카오가 돌려준 실패 사유를 그대로 올린다.
 *
 * 원본은 전부 '주소 검색에 실패했습니다.' 로 뭉갰는데, 그러면 키가 잘못된 건지
 * 서비스가 꺼진 건지 화면에서 알 수가 없다.
 */
async function kakaoError(response: Response): Promise<Error> {
  let detail = ''
  try {
    const body = await response.json() as { message?: string; errorType?: string }
    detail = body.message ?? body.errorType ?? ''
  } catch {
    detail = ''
  }
  if (/disabled OPEN_MAP_AND_LOCAL/i.test(detail)) {
    return new Error('카카오 개발자센터에서 이 앱의 카카오맵(로컬) 서비스를 켜야 주소 검색이 됩니다.')
  }
  if (response.status === 401) {
    return new Error('카카오 REST API 키가 올바르지 않습니다.')
  }
  return new Error(detail ? `주소 검색 실패: ${detail}` : `주소 검색 실패 (HTTP ${response.status})`)
}

async function fetchKakaoAddressPage(query: string, page: number) {
  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json')
  url.searchParams.set('query', query)
  url.searchParams.set('page', String(page))
  url.searchParams.set('size', '15')
  const response = await fetch(url, { headers: kakaoHeaders() })
  if (!response.ok) throw await kakaoError(response)
  return (await response.json()) as { documents?: KakaoAddressDocument[]; meta?: KakaoSearchMeta }
}

async function fetchKakaoKeywordPage(query: string, page: number) {
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
  url.searchParams.set('query', query)
  url.searchParams.set('page', String(page))
  url.searchParams.set('size', '15')
  const response = await fetch(url, { headers: kakaoHeaders() })
  // 키워드 검색은 보조 수단이라 실패해도 주소 검색 결과만으로 진행한다.
  // 다만 권한 문제는 주소 검색에서도 똑같이 나므로 거기서 걸린다.
  if (!response.ok) return { documents: [], meta: { is_end: true } }
  return (await response.json()) as { documents?: KakaoKeywordDocument[]; meta?: KakaoSearchMeta }
}

async function collectAddressSearch(query: string, seen: Set<string>, results: AddressCandidate[], maxResults: number) {
  for (let page = 1; page <= 3; page += 1) {
    const payload = await fetchKakaoAddressPage(query, page)
    const pageItems = (payload.documents ?? [])
      .map(fromAddressDocument)
      .filter((item): item is AddressCandidate => Boolean(item))

    for (const item of pageItems) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      results.push(item)
      if (results.length >= maxResults) return
    }

    if (payload.meta?.is_end || pageItems.length === 0) break
  }
}

async function collectKeywordSearch(query: string, seen: Set<string>, results: AddressCandidate[], maxResults: number) {
  for (let page = 1; page <= 2; page += 1) {
    const payload = await fetchKakaoKeywordPage(query, page)
    const pageItems = (payload.documents ?? [])
      .map(fromKeywordDocument)
      .filter((item): item is AddressCandidate => Boolean(item))

    for (const item of pageItems) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      results.push(item)
      if (results.length >= maxResults) return
    }

    if (payload.meta?.is_end || pageItems.length === 0) break
  }
}

async function searchAddresses(query: string): Promise<AddressCandidate[]> {
  const maxResults = 45
  const seen = new Set<string>()
  const results: AddressCandidate[] = []
  const searchQueries = buildSearchQueries(query)

  for (const keyword of searchQueries) {
    await collectAddressSearch(keyword, seen, results, maxResults)
    if (results.length >= maxResults) break
  }

  if (results.length < 5) {
    for (const keyword of searchQueries) {
      await collectKeywordSearch(keyword, seen, results, maxResults)
      if (results.length >= maxResults) break
    }
  }

  return results
}

async function reverseAddress(lat: number, lng: number): Promise<AddressCandidate> {
  const url = new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json')
  url.searchParams.set('x', String(lng))
  url.searchParams.set('y', String(lat))
  url.searchParams.set('input_coord', 'WGS84')
  const response = await fetch(url, { headers: kakaoHeaders() })
  if (!response.ok) throw await kakaoError(response)
  const payload = (await response.json()) as { documents?: KakaoCoordDocument[] }
  const doc = payload.documents?.[0]
  if (!doc) throw new Error('이 위치의 주소를 찾지 못했습니다. 주소 검색을 이용해 주세요.')

  const road = doc.road_address
  const jibun = doc.address
  const address = road?.address_name || jibun?.address_name || ''
  if (!address) throw new Error('이 위치의 주소를 찾지 못했습니다. 주소 검색을 이용해 주세요.')

  const zonecode = road?.zone_no || jibun?.zone_no || ''
  const name = road?.building_name?.trim() || address

  return {
    id: `coord:${lng},${lat}`,
    name,
    address,
    zonecode,
    lat,
    lng,
  }
}


export const naverAddress: FnHandler = async ({ userId, body }) => {
  if (!userId) return fail('로그인이 필요합니다.', 401)
  try {
    if (body?.action === 'search') {
      const query = body.query?.trim() ?? ''
      if (query.length < 2) return fail('검색어를 입력해 주세요.')
      return ok({ results: await searchAddresses(query) })
    }
    if (body?.action === 'reverse') {
      if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
        return fail('위치 정보가 올바르지 않습니다.')
      }
      return ok({ result: await reverseAddress(body.lat, body.lng) })
    }
    return fail('요청이 올바르지 않습니다.')
  } catch (err) {
    return fail(err instanceof Error ? err.message : '주소 조회에 실패했습니다.', 500)
  }
}
