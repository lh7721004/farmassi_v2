import { loadSchema, findRelation } from '../src/schema.ts'
import { adminPool, appPool } from '../src/db.ts'

const s = await loadSchema()
console.log('  테이블 수:', s.columns.size, ' FK 수:', s.foreignKeys.length)
for (const [from, to] of [['orders','order_items'],['orders','farms'],['orders','shipments'],['order_items','products']]) {
  const r = findRelation(s, from, to)
  console.log(`  ${from} → ${to}: ${r.kind} (${from}.${r.localColumn} = ${to}.${r.foreignColumn})`)
}
try { findRelation(s, 'orders', 'notifications') } catch (e) { console.log('  관계 없음 처리:', (e as Error).message) }
await appPool.end(); await adminPool.end()
