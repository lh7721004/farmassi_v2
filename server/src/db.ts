import pg from 'pg'
import { config } from './config.ts'

const { Pool, types } = pg

/**
 * 시각을 PostgREST 와 같은 형식으로 낸다.
 *
 * node-postgres 는 timestamptz 를 JS Date 로 바꾸는데, 그러면 JSON 직렬화 때
 * 밀리초까지만 남고 '...Z' 형식이 된다. 원본 백엔드(PostgREST)는 마이크로초까지
 * 살린 '...+00:00' 문자열을 준다. 값을 그대로 문자열로 넘겨 형식을 맞춘다.
 * (접속 시 timezone=UTC 를 걸어 두므로 오프셋은 항상 +00 이다.)
 */
const asPostgrestTimestamp = (value: string | null) =>
  value === null ? null : value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')

types.setTypeParser(1184, asPostgrestTimestamp)  // timestamptz
types.setTypeParser(1114, (v: string | null) => (v === null ? null : v.replace(' ', 'T')))  // timestamp
// date 는 'YYYY-MM-DD' 그대로 둔다. 기본값은 JS Date 라 JSON 에서 '...T00:00:00.000Z'
// 가 되는데, 화면의 date 입력은 'YYYY-MM-DD' 를 쓴다.
types.setTypeParser(1082, (v: string | null) => v)  // date

/**
 * 접속 풀 두 개.
 *
 * app   — RLS 가 적용된다. 사용자 요청은 전부 이쪽으로 나간다.
 *         요청마다 request.jwt.claim.sub 를 걸어서 DB 가 본인 행만 보여주게 한다.
 * admin — RLS 를 우회한다. 주문번호 발급, 입금 대사처럼 여러 사용자의 데이터를
 *         가로질러야 하는 서버 내부 작업에만 쓴다.
 */
export const appPool = new Pool({ connectionString: config.dbAppUrl, max: 10,
  options: '-c timezone=UTC' })
export const adminPool = new Pool({ connectionString: config.dbAdminUrl, max: 4,
  options: '-c timezone=UTC' })

export type Db = pg.PoolClient

/**
 * 사용자 컨텍스트를 걸고 작업을 실행한다.
 *
 * set_config 의 세 번째 인자가 true 라 트랜잭션이 끝나면 설정이 자동으로 풀린다.
 * 풀에 반납된 커넥션에 이전 사용자 정보가 남지 않게 하려는 것이다.
 */
export async function withUser<T>(
  userId: string | null,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const client = await appPool.connect()
  try {
    await client.query('begin')
    if (userId) {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ])
    } else {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: 'anon' }),
      ])
    }
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** RLS 를 우회하는 작업. 호출부에서 스스로 권한을 확인해야 한다. */
export async function withAdmin<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await adminPool.connect()
  try {
    await client.query('begin')
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role: 'service_role' }),
    ])
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
