import type { Db } from './db.ts'
import { assertColumn, assertTable, findRelation, invalidateSchema, loadSchema,
         UnknownIdentifierError, type SchemaInfo } from './schema.ts'

/**
 * 데이터 게이트웨이.
 *
 * 프론트가 쓰던 조회 형태(컬럼 목록, 임베드 관계, eq/in, order, limit, single)를
 * 그대로 받아 SQL 로 옮긴다. 값은 전부 파라미터로 넘기고, 테이블·컬럼 이름은
 * 스키마 메타데이터에 있는 것만 통과시킨다.
 *
 * 행 단위 접근 제어는 여기서 하지 않는다. RLS 가 한다.
 */

export type FilterOp = 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is'

export interface QueryRequest {
  table: string
  op?: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  select?: string
  filters?: Array<{ column: string; op: FilterOp; value: unknown }>
  order?: Array<{ column: string; ascending?: boolean; nullsFirst?: boolean }>
  limit?: number
  offset?: number
  single?: 'one' | 'maybe'
  count?: 'exact'
  head?: boolean
  values?: Record<string, unknown> | Array<Record<string, unknown>>
  onConflict?: string
  returning?: boolean
}

interface SelectNode {
  columns: string[]          // 빈 배열이면 전체(*)
  embeds: Array<{ alias: string; table: string; node: SelectNode }>
}

/** 'a, b, rel(x, y), alias:rel2(*)' 를 트리로 만든다. */
export function parseSelect(input: string | undefined): SelectNode {
  const node: SelectNode = { columns: [], embeds: [] }
  const text = (input ?? '*').trim()
  if (text === '' || text === '*') return node

  for (const part of splitTopLevel(text)) {
    const open = part.indexOf('(')
    if (open === -1) {
      if (part === '*') continue
      node.columns.push(part)
      continue
    }
    const head = part.slice(0, open).trim()
    const inner = part.slice(open + 1, part.lastIndexOf(')'))
    const [aliasOrTable, maybeTable] = head.split(':').map((s) => s.trim())
    const table = maybeTable ?? aliasOrTable
    const alias = maybeTable ? aliasOrTable : aliasOrTable
    node.embeds.push({ alias, table, node: parseSelect(inner) })
  }
  return node
}

function splitTopLevel(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      if (current.trim()) out.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) out.push(current.trim())
  return out
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`

interface BuildContext {
  schema: SchemaInfo
  params: unknown[]
  aliasSeq: { n: number }
}

function nextAlias(ctx: BuildContext): string {
  ctx.aliasSeq.n += 1
  return `t${ctx.aliasSeq.n}`
}

function bind(ctx: BuildContext, value: unknown): string {
  ctx.params.push(value)
  return `$${ctx.params.length}`
}

/** select 목록을 만든다. 임베드는 스칼라 서브쿼리로 붙인다. */
function buildSelectList(ctx: BuildContext, table: string, alias: string, node: SelectNode): string {
  const pieces: string[] = []

  if (node.columns.length === 0) {
    pieces.push(`${alias}.*`)
  } else {
    for (const column of node.columns) {
      assertColumn(ctx.schema, table, column)
      pieces.push(`${alias}.${quote(column)}`)
    }
  }

  for (const embed of node.embeds) {
    assertTable(ctx.schema, embed.table)
    const relation = findRelation(ctx.schema, table, embed.table)
    const childAlias = nextAlias(ctx)
    const innerList = buildSelectList(ctx, embed.table, childAlias, embed.node)
    const join =
      `${childAlias}.${quote(relation.foreignColumn)} = ${alias}.${quote(relation.localColumn)}`

    if (relation.kind === 'one-to-many') {
      pieces.push(
        `coalesce((select json_agg(row_to_json(sub)) from ` +
          `(select ${innerList} from ${quote(embed.table)} ${childAlias} where ${join}) sub), '[]'::json)` +
          ` as ${quote(embed.alias)}`,
      )
    } else {
      pieces.push(
        `(select row_to_json(sub) from ` +
          `(select ${innerList} from ${quote(embed.table)} ${childAlias} where ${join} limit 1) sub)` +
          ` as ${quote(embed.alias)}`,
      )
    }
  }

  return pieces.join(', ')
}

function buildWhere(ctx: BuildContext, table: string, alias: string, filters: QueryRequest['filters']): string {
  if (!filters || filters.length === 0) return ''
  const clauses = filters.map((filter) => {
    assertColumn(ctx.schema, table, filter.column)
    const column = `${alias}.${quote(filter.column)}`
    switch (filter.op) {
      case 'eq': return `${column} = ${bind(ctx, filter.value)}`
      case 'neq': return `${column} <> ${bind(ctx, filter.value)}`
      case 'gt': return `${column} > ${bind(ctx, filter.value)}`
      case 'gte': return `${column} >= ${bind(ctx, filter.value)}`
      case 'lt': return `${column} < ${bind(ctx, filter.value)}`
      case 'lte': return `${column} <= ${bind(ctx, filter.value)}`
      case 'like': return `${column} like ${bind(ctx, filter.value)}`
      case 'ilike': return `${column} ilike ${bind(ctx, filter.value)}`
      case 'is': return filter.value === null ? `${column} is null` : `${column} is ${bind(ctx, filter.value)}`
      case 'in': {
        const list = Array.isArray(filter.value) ? filter.value : [filter.value]
        if (list.length === 0) return 'false'
        return `${column} = any(${bind(ctx, list)})`
      }
      default: throw new Error(`지원하지 않는 연산자: ${filter.op}`)
    }
  })
  return ` where ${clauses.join(' and ')}`
}

export interface QueryResult {
  data: unknown
  count: number | null
}

/**
 * 스키마 캐시는 기동 시 한 번 읽는다. 마이그레이션으로 컬럼이 늘면 캐시가 낡아
 * 멀쩡한 컬럼을 '알 수 없는 컬럼'으로 막는다. 그때 한 번만 다시 읽고 재시도한다.
 */
export async function runQuery(db: Db, request: QueryRequest): Promise<QueryResult> {
  try {
    return await runQueryOnce(db, request)
  } catch (error) {
    if (!(error instanceof UnknownIdentifierError)) throw error
    invalidateSchema()
    return await runQueryOnce(db, request)
  }
}

async function runQueryOnce(db: Db, request: QueryRequest): Promise<QueryResult> {
  const schema = await loadSchema()
  assertTable(schema, request.table)
  const op = request.op ?? 'select'
  const ctx: BuildContext = { schema, params: [], aliasSeq: { n: 0 } }
  const alias = 't0'

  if (op === 'select') {
    let count: number | null = null
    if (request.count === 'exact') {
      const countCtx: BuildContext = { schema, params: [], aliasSeq: { n: 100 } }
      const where = buildWhere(countCtx, request.table, alias, request.filters)
      const sql = `select count(*)::int as n from ${quote(request.table)} ${alias}${where}`
      count = (await db.query<{ n: number }>(sql, countCtx.params)).rows[0].n
      if (request.head) return { data: null, count }
    }

    const node = parseSelect(request.select)
    const list = buildSelectList(ctx, request.table, alias, node)
    let sql = `select ${list} from ${quote(request.table)} ${alias}`
    sql += buildWhere(ctx, request.table, alias, request.filters)

    if (request.order?.length) {
      const parts = request.order.map((o) => {
        assertColumn(schema, request.table, o.column)
        const dir = o.ascending === false ? 'desc' : 'asc'
        const nulls = o.nullsFirst === undefined ? '' : o.nullsFirst ? ' nulls first' : ' nulls last'
        return `${alias}.${quote(o.column)} ${dir}${nulls}`
      })
      sql += ` order by ${parts.join(', ')}`
    }

    if (request.single) {
      // single/maybeSingle 은 2건 이상인지 알아야 판정이 된다. 다만 호출부가 limit 을
      // 줬으면 그 값을 넘기지 않는다 (.limit(1).maybeSingle() 이 오류가 되면 안 된다).
      const cap = request.limit !== undefined ? Math.min(Number(request.limit) | 0, 2) : 2
      sql += ` limit ${cap}`
    } else if (request.limit !== undefined) sql += ` limit ${Number(request.limit) | 0}`
    if (request.offset) sql += ` offset ${Number(request.offset) | 0}`

    const rows = (await db.query(sql, ctx.params)).rows
    if (request.single === 'one') {
      if (rows.length !== 1) throw new Error(rows.length === 0 ? '행을 찾을 수 없습니다.' : '행이 여러 개입니다.')
      return { data: rows[0], count }
    }
    if (request.single === 'maybe') {
      if (rows.length > 1) throw new Error('행이 여러 개입니다.')
      return { data: rows[0] ?? null, count }
    }
    return { data: rows, count }
  }

  if (op === 'insert' || op === 'upsert') {
    const list = Array.isArray(request.values) ? request.values : [request.values ?? {}]
    if (list.length === 0) return { data: [], count: null }
    const columns = [...new Set(list.flatMap((row) => Object.keys(row)))]
    for (const column of columns) assertColumn(schema, request.table, column)

    const tuples = list.map((row) =>
      `(${columns.map((c) => bind(ctx, row[c] ?? null)).join(', ')})`)

    let sql = `insert into ${quote(request.table)} (${columns.map(quote).join(', ')}) values ${tuples.join(', ')}`

    if (op === 'upsert') {
      const conflict = (request.onConflict ?? 'id').split(',').map((c) => c.trim())
      for (const column of conflict) assertColumn(schema, request.table, column)
      const updates = columns.filter((c) => !conflict.includes(c))
      sql += ` on conflict (${conflict.map(quote).join(', ')}) do ` +
        (updates.length
          ? `update set ${updates.map((c) => `${quote(c)} = excluded.${quote(c)}`).join(', ')}`
          : 'nothing')
    }

    if (request.returning !== false) sql += ' returning *'
    const rows = (await db.query(sql, ctx.params)).rows
    if (request.single) return { data: rows[0] ?? null, count: null }
    return { data: rows, count: null }
  }

  if (op === 'update') {
    const values = (request.values ?? {}) as Record<string, unknown>
    const columns = Object.keys(values)
    if (columns.length === 0) throw new Error('수정할 값이 없습니다.')
    for (const column of columns) assertColumn(schema, request.table, column)

    let sql = `update ${quote(request.table)} ${alias} set ` +
      columns.map((c) => `${quote(c)} = ${bind(ctx, values[c])}`).join(', ')
    sql += buildWhere(ctx, request.table, alias, request.filters)
    if (request.returning !== false) sql += ' returning *'
    const rows = (await db.query(sql, ctx.params)).rows
    if (request.single) return { data: rows[0] ?? null, count: null }
    return { data: rows, count: null }
  }

  if (op === 'delete') {
    let sql = `delete from ${quote(request.table)} ${alias}`
    sql += buildWhere(ctx, request.table, alias, request.filters)
    if (request.returning !== false) sql += ' returning *'
    const rows = (await db.query(sql, ctx.params)).rows
    return { data: rows, count: null }
  }

  throw new Error(`지원하지 않는 동작: ${op}`)
}
