import type { Db } from './db.ts'
import { runQuery, type FilterOp, type QueryRequest } from './query.ts'

/**
 * Supabase 클라이언트와 같은 모양의 빌더.
 *
 * Edge Function 들이 `admin.from('orders').select('*').eq('id', x).maybeSingle()`
 * 형태로 쓰여 있다. 그 코드를 그대로 옮기기 위해 같은 문법을 게이트웨이 위에 얹는다.
 * 반환도 Supabase 와 같은 { data, error } 다.
 */

export interface Result<T = any> { data: T; error: { message: string } | null }

class Builder implements PromiseLike<Result> {
  private request: QueryRequest
  private db: Db

  constructor(db: Db, table: string) {
    this.db = db
    this.request = { table, op: 'select' }
  }

  select(columns = '*') { this.request.select = columns; if (this.request.op !== 'select') this.request.returning = true; return this }
  insert(values: any) { this.request.op = 'insert'; this.request.values = values; return this }
  upsert(values: any, options?: { onConflict?: string }) {
    this.request.op = 'upsert'; this.request.values = values
    if (options?.onConflict) this.request.onConflict = options.onConflict
    return this
  }
  update(values: any) { this.request.op = 'update'; this.request.values = values; return this }
  delete() { this.request.op = 'delete'; return this }

  private filter(column: string, op: FilterOp, value: unknown) {
    ;(this.request.filters ??= []).push({ column, op, value })
    return this
  }
  eq(column: string, value: unknown) { return this.filter(column, 'eq', value) }
  neq(column: string, value: unknown) { return this.filter(column, 'neq', value) }
  in(column: string, value: unknown[]) { return this.filter(column, 'in', value) }
  gte(column: string, value: unknown) { return this.filter(column, 'gte', value) }
  lte(column: string, value: unknown) { return this.filter(column, 'lte', value) }
  is(column: string, value: unknown) { return this.filter(column, 'is', value) }

  order(column: string, options?: { ascending?: boolean }) {
    ;(this.request.order ??= []).push({ column, ascending: options?.ascending ?? true })
    return this
  }
  limit(n: number) { this.request.limit = n; return this }
  single() { this.request.single = 'one'; return this }
  maybeSingle() { this.request.single = 'maybe'; return this }

  async run(): Promise<Result> {
    try {
      const { data } = await runQuery(this.db, this.request)
      return { data, error: null }
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }
    }
  }

  then<A, B>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
             onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected)
  }
}

export function sb(db: Db) {
  return { from: (table: string) => new Builder(db, table) }
}
