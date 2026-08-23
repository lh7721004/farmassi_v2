/**
 * 로컬 서버 관리자 웹 — DB 조회와 로그 열람.
 *
 * 이 맥이 곧 서버라 운영 DB 와 로그가 전부 여기 있다. psql 과 tail 을 오가는
 * 대신 브라우저에서 한 번에 보려고 만든 도구다.
 *
 * 설계상 지키는 것 두 가지:
 *  1. 127.0.0.1 에만 바인딩한다. nginx 에 올리지 않는다. 인증이 없는 이유가
 *     이것이므로, 외부로 뚫는 순간 DB 전체가 열린다.
 *  2. DB 는 ops_ro(읽기 전용) 로만 붙고, 질의는 READ ONLY 트랜잭션으로 감싼다.
 *     롤 권한과 트랜잭션 양쪽에서 막는다.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.OPS_PORT ?? 4399)
const ROW_LIMIT = 500
const STATEMENT_TIMEOUT = '10s'

/** 조회 대상 DB. 라벨은 화면에 그대로 나온다. */
const DATABASES = {
  prod: { label: '운영 (farmassi)', url: process.env.OPS_DATABASE_URL },
  dev: { label: '개발 (farmassi_dev)', url: process.env.OPS_DATABASE_URL_DEV },
} as const
type DbKey = keyof typeof DATABASES

/**
 * 열람 가능한 로그 목록.
 *
 * 화이트리스트로 둔다. 경로를 요청에서 받으면 임의 파일 읽기가 되므로
 * id 만 받고 경로는 서버가 정한다.
 */
const LOGS = {
  api: { label: '운영 API', path: join(here, '../api.log') },
  'api-err': { label: '운영 API 오류', path: join(here, '../api.err.log') },
  'api-dev': { label: '개발 API', path: join(here, '../api-dev.log') },
  'api-dev-err': { label: '개발 API 오류', path: join(here, '../api-dev.err.log') },
  backup: { label: 'DB 백업', path: join(process.env.HOME!, 'FetchAccount/db-backups/backup.log') },
  'nginx-access': { label: 'nginx 접속', path: '/opt/homebrew/var/log/nginx/access.log' },
  'nginx-error': { label: 'nginx 오류', path: '/opt/homebrew/var/log/nginx/error.log' },
} as const
type LogKey = keyof typeof LOGS

const pools = new Map<DbKey, pg.Pool>()
function poolFor(key: DbKey): pg.Pool {
  const existing = pools.get(key)
  if (existing) return existing
  const url = DATABASES[key].url
  if (!url) throw new Error(`${key} DB 접속 정보(OPS_DATABASE_URL*)가 없습니다.`)
  const pool = new pg.Pool({ connectionString: url, max: 3, options: '-c timezone=Asia/Seoul' })
  pools.set(key, pool)
  return pool
}

/** 결과를 그대로 보여주는 도구라 값을 가공하지 않고 문자열로 넘긴다. */
for (const oid of [1114, 1184, 20, 1700]) pg.types.setTypeParser(oid, (v: string) => v)

async function runQuery(db: DbKey, sql: string) {
  const client = await poolFor(db).connect()
  try {
    await client.query('begin read only')
    await client.query(`set local statement_timeout = '${STATEMENT_TIMEOUT}'`)
    const started = Date.now()
    const result = await client.query({ text: sql, rowMode: 'array' })
    const elapsed = Date.now() - started
    const rows = Array.isArray(result.rows) ? result.rows : []
    return {
      columns: (result.fields ?? []).map((f) => f.name),
      rows: rows.slice(0, ROW_LIMIT),
      total: rows.length,
      truncated: rows.length > ROW_LIMIT,
      command: result.command,
      elapsed,
    }
  } finally {
    await client.query('rollback').catch(() => {})
    client.release()
  }
}

async function listTables(db: DbKey) {
  const { rows } = await poolFor(db).query<{ schema: string; name: string; rows: string }>(`
    select n.nspname as schema, c.relname as name,
           case when c.reltuples < 0 then '?' else c.reltuples::bigint::text end as rows
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','v','m','p')
      and n.nspname in ('public','auth','private')
    order by n.nspname, c.relname`)
  return rows
}

/** tail 로 끝부분만 읽는다. 파일이 커도 메모리를 쓰지 않게. */
function tail(path: string, lines: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/tail', ['-n', String(lines), path], { maxBuffer: 8 << 20 }, (err, stdout) =>
      err ? reject(new Error(`읽을 수 없습니다: ${err.message}`)) : resolve(stdout),
    )
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(payload)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1 << 20) reject(new Error('요청이 너무 큽니다.'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

/**
 * DNS 리바인딩 방어.
 *
 * 127.0.0.1 에만 바인딩해도, 외부 웹페이지가 자기 도메인을 127.0.0.1 로
 * 가리키게 만들면 브라우저가 이 서버를 부를 수 있다. Host 헤더가 로컬이 아닌
 * 요청을 막으면 그 경로가 닫힌다.
 */
function localHost(req: IncomingMessage): boolean {
  const host = (req.headers.host ?? '').split(':')[0]
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
}

const server = createServer(async (req, res) => {
  if (!localHost(req)) return send(res, 403, { error: 'localhost 로만 접근할 수 있습니다.' })

  const url = new URL(req.url ?? '/', 'http://localhost')
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const html = await readFile(join(here, 'ui.html'))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end(html)
    }

    if (req.method === 'GET' && url.pathname === '/api/meta') {
      const logs = await Promise.all(
        (Object.keys(LOGS) as LogKey[]).map(async (id) => {
          const info = await stat(LOGS[id].path).catch(() => null)
          return { id, label: LOGS[id].label, size: info?.size ?? null, mtime: info?.mtime ?? null }
        }),
      )
      const databases = await Promise.all(
        (Object.keys(DATABASES) as DbKey[]).map(async (id) => ({
          id,
          label: DATABASES[id].label,
          tables: DATABASES[id].url ? await listTables(id).catch(() => []) : [],
        })),
      )
      return send(res, 200, { databases, logs, rowLimit: ROW_LIMIT })
    }

    if (req.method === 'POST' && url.pathname === '/api/query') {
      const { db, sql } = JSON.parse(await readBody(req)) as { db: DbKey; sql: string }
      if (!(db in DATABASES)) return send(res, 400, { error: '알 수 없는 DB 입니다.' })
      if (!sql?.trim()) return send(res, 400, { error: '질의가 비어 있습니다.' })
      return send(res, 200, await runQuery(db, sql))
    }

    if (req.method === 'GET' && url.pathname === '/api/log') {
      const id = url.searchParams.get('id') as LogKey
      if (!(id in LOGS)) return send(res, 400, { error: '알 수 없는 로그입니다.' })
      const lines = Math.min(Math.max(Number(url.searchParams.get('lines') ?? 200), 1), 5000)
      const q = url.searchParams.get('q')?.trim()
      let text = await tail(LOGS[id].path, q ? Math.max(lines, 5000) : lines)
      if (q) {
        const needle = q.toLowerCase()
        text = text.split('\n').filter((l) => l.toLowerCase().includes(needle)).slice(-lines).join('\n')
      }
      return send(res, 200, { text })
    }

    send(res, 404, { error: '없는 경로입니다.' })
  } catch (err) {
    send(res, 400, { error: err instanceof Error ? err.message : String(err) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`farmassi 관리자 웹 → http://127.0.0.1:${PORT}  (로컬 전용, 읽기 전용 DB)`)
})
