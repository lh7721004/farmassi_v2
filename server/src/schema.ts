import { adminPool } from './db.ts'

/**
 * 스키마 메타데이터.
 *
 * 쿼리 게이트웨이는 클라이언트가 보낸 테이블명·컬럼명을 SQL 에 그대로 넣는다.
 * 그래서 여기 등록된 이름만 통과시킨다. 값은 전부 파라미터로 넘기므로,
 * 식별자 화이트리스트 + 파라미터 바인딩 두 겹으로 주입을 막는다.
 */

export interface ForeignKey {
  table: string        // 참조하는 쪽 (자식)
  column: string       // 자식의 FK 컬럼
  targetTable: string  // 참조되는 쪽 (부모)
  targetColumn: string
}

export interface SchemaInfo {
  columns: Map<string, Set<string>>
  foreignKeys: ForeignKey[]
}

let cache: SchemaInfo | null = null

export async function loadSchema(): Promise<SchemaInfo> {
  if (cache) return cache

  const client = await adminPool.connect()
  try {
    const cols = await client.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name
         from information_schema.columns
        where table_schema = 'public'`,
    )
    const columns = new Map<string, Set<string>>()
    for (const row of cols.rows) {
      if (!columns.has(row.table_name)) columns.set(row.table_name, new Set())
      columns.get(row.table_name)!.add(row.column_name)
    }

    // information_schema 는 권한으로 걸러져서 테이블 소유자가 아니면 제약을 못 본다.
    // pg_catalog 는 그런 필터가 없다.
    const fks = await client.query<ForeignKey>(
      `select con.conrelid::regclass::text  as "table",
              att.attname                   as "column",
              con.confrelid::regclass::text as "targetTable",
              fatt.attname                  as "targetColumn"
         from pg_constraint con
         join pg_namespace ns on ns.oid = con.connamespace and ns.nspname = 'public'
         join unnest(con.conkey)  with ordinality as k(attnum, ord)  on true
         join unnest(con.confkey) with ordinality as f(attnum, ord)  on f.ord = k.ord
         join pg_attribute att  on att.attrelid  = con.conrelid  and att.attnum  = k.attnum
         join pg_attribute fatt on fatt.attrelid = con.confrelid and fatt.attnum = f.attnum
        where con.contype = 'f'`,
    )

    cache = { columns, foreignKeys: fks.rows }
    return cache
  } finally {
    client.release()
  }
}

/** 캐시에 없는 이름일 때 던진다. 마이그레이션 직후일 수 있으므로 호출부가 한 번 다시 읽는다. */
export class UnknownIdentifierError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnknownIdentifierError'
  }
}

/** 스키마가 바뀌었을 수 있을 때 캐시를 버린다. */
export function invalidateSchema(): void {
  cache = null
}

export function assertTable(schema: SchemaInfo, table: string): void {
  if (!schema.columns.has(table)) throw new UnknownIdentifierError(`알 수 없는 테이블: ${table}`)
}

export function assertColumn(schema: SchemaInfo, table: string, column: string): void {
  if (!schema.columns.get(table)?.has(column)) {
    throw new UnknownIdentifierError(`알 수 없는 컬럼: ${table}.${column}`)
  }
}

/**
 * from 테이블에서 target 테이블을 임베드할 때의 관계를 찾는다.
 *
 * many-to-one : from 이 target 을 가리키는 FK 를 갖고 있다 (orders.farm_id → farms.id)
 * one-to-many : target 이 from 을 가리키는 FK 를 갖고 있다 (order_items.order_id → orders.id)
 */
export function findRelation(
  schema: SchemaInfo,
  from: string,
  target: string,
): { kind: 'many-to-one' | 'one-to-many'; localColumn: string; foreignColumn: string } {
  const toParent = schema.foreignKeys.find((fk) => fk.table === from && fk.targetTable === target)
  if (toParent) {
    return { kind: 'many-to-one', localColumn: toParent.column, foreignColumn: toParent.targetColumn }
  }
  const toChild = schema.foreignKeys.find((fk) => fk.table === target && fk.targetTable === from)
  if (toChild) {
    return { kind: 'one-to-many', localColumn: toChild.targetColumn, foreignColumn: toChild.column }
  }
  throw new Error(`${from} 과 ${target} 사이의 관계를 찾을 수 없습니다.`)
}
