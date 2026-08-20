import { withAdmin, withUser, appPool, adminPool } from '../src/db.ts'
import { runQuery } from '../src/query.ts'

const RESET = `
  delete from shipments; delete from order_items; delete from orders;
  delete from products; delete from farm_members; delete from farms;
  delete from deposit_transactions; delete from notifications;
  delete from auth.users;`

const A = '11111111-1111-1111-1111-111111111111'  // 고객
const B = '22222222-2222-2222-2222-222222222222'  // 농가 주인
let farmId = '', orderId = '', productId = ''

await withAdmin(async (db) => {
  await db.query(RESET)
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
    ($1,'a@e.com','{"nickname":"김이현"}'), ($2,'b@e.com','{"nickname":"박지훈"}')`, [A, B])
  farmId = (await db.query(`insert into farms (slug,name,owner_user_id,bank_name,account_number,account_holder)
    values ('haneul','하늘농원',$1,'농협','3522405606253','박지훈') returning id`, [B])).rows[0].id
  await db.query('insert into farm_members (farm_id,user_id) values ($1,$2)', [farmId, B])
  productId = (await db.query(`insert into products (farm_id,name,price,parcel_weight_kg)
    values ($1,'꿀사과 5kg',25000,5) returning id`, [farmId])).rows[0].id
  orderId = (await db.query(`insert into orders
    (order_no,farm_id,customer_id,recipient_name,recipient_phone,address,total_amount,deposit_due_amount,deposit_code,status)
    values ('FA260819-AB12',$1,$2,'김이현','01011112222','서울시 강남구',25000,25000,'K7M2QP','paid') returning id`,
    [farmId, A])).rows[0].id
  await db.query(`insert into order_items (order_id,product_id,product_name,unit_price,quantity,line_amount)
    values ($1,$2,'꿀사과 5kg',25000,1,25000)`, [orderId, productId])
  await db.query('insert into shipments (order_id, provider) values ($1, $2)', [orderId, 'kpost'])
})

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

// 1. 프론트가 실제로 쓰는 select 문자열 (admin/Orders.tsx)
const r1: any = await withUser(A, (db) => runQuery(db, {
  table: 'orders',
  select: '*, order_items(*), shipments(*), farms(name, slug)',
  filters: [{ column: 'customer_id', op: 'eq', value: A }],
  order: [{ column: 'created_at', ascending: false }],
}))
const o = r1.data[0]
// shipments 는 정책상 관리자·농가 직원만 볼 수 있다. 고객에게는 빈 배열이 정상.
check('임베드 조회 (1:N + N:1)', r1.data.length === 1 && Array.isArray(o.order_items)
  && o.order_items.length === 1 && o.farms?.name === '하늘농원' && o.shipments?.length === 0,
  `items=${o?.order_items?.length} farm=${o?.farms?.name} ship=${o?.shipments?.length}`)

// 같은 쿼리를 농가 직원이 하면 shipments 가 보여야 한다 (임베드에도 RLS 가 걸리는지 확인)
const r1b: any = await withUser(B, (db) => runQuery(db, {
  table: 'orders', select: '*, shipments(*)',
}))
check('임베드에도 RLS 적용', r1b.data[0]?.shipments?.[0]?.provider === 'kpost',
  `ship=${r1b.data[0]?.shipments?.length}`)

// 2. 중첩 임베드 + 별칭 (admin/Shipments.tsx 의 ORDER_SELECT)
const r2: any = await withUser(A, (db) => runQuery(db, {
  table: 'orders',
  select: '*, order_items(*, product:products(parcel_weight_kg, parcel_content_code)), farms(name, slug)',
  filters: [{ column: 'status', op: 'in', value: ['paid', 'packing'] }],
}))
check('중첩 임베드 + 별칭', r2.data[0]?.order_items[0]?.product?.parcel_weight_kg === '5.00'
  || Number(r2.data[0]?.order_items[0]?.product?.parcel_weight_kg) === 5,
  `product=${JSON.stringify(r2.data[0]?.order_items[0]?.product)}`)

// 3. RLS: 남(B)이 이 주문을 보면? 농가 직원이므로 보여야 한다
const r3: any = await withUser(B, (db) => runQuery(db, { table: 'orders', select: 'id' }))
check('농가 직원은 자기 농가 주문을 봄', r3.data.length === 1)

// 4. RLS: 비로그인은 못 봄
const r4: any = await withUser(null, (db) => runQuery(db, { table: 'orders', select: 'id' }))
check('비로그인은 주문 0건', r4.data.length === 0)

// 5. count + head
const r5 = await withUser(A, (db) => runQuery(db, {
  table: 'orders', select: 'id', count: 'exact', head: true,
}))
check('count exact head', r5.count === 1 && r5.data === null, `count=${r5.count}`)

// 6. maybeSingle
const r6: any = await withUser(A, (db) => runQuery(db, {
  table: 'orders', select: '*', filters: [{ column: 'id', op: 'eq', value: orderId }], single: 'maybe',
}))
check('maybeSingle', r6.data?.order_no === 'FA260819-AB12')

// 7. maybeSingle 없는 행 → null
const r7: any = await withUser(A, (db) => runQuery(db, {
  table: 'orders', select: '*',
  filters: [{ column: 'id', op: 'eq', value: '00000000-0000-0000-0000-000000000000' }], single: 'maybe',
}))
check('maybeSingle 없으면 null', r7.data === null)

// 8. update — 고객이 남의 농가 상품을 수정 시도 (RLS 로 0건이어야 함)
const r8: any = await withUser(A, (db) => runQuery(db, {
  table: 'products', op: 'update', values: { price: 1 },
  filters: [{ column: 'id', op: 'eq', value: productId }],
}))
check('고객의 상품 수정은 차단', r8.data.length === 0)

// 9. update — 농가 주인은 수정 가능
const r9: any = await withUser(B, (db) => runQuery(db, {
  table: 'products', op: 'update', values: { price: 27000 },
  filters: [{ column: 'id', op: 'eq', value: productId }],
}))
check('농가 주인은 상품 수정 가능', r9.data[0]?.price === 27000, `price=${r9.data[0]?.price}`)

// 10. 주입 시도 — 스키마에 없는 이름
try {
  await withUser(A, (db) => runQuery(db, { table: 'orders; drop table orders', select: '*' }))
  check('알 수 없는 테이블 차단', false)
} catch (e) { check('알 수 없는 테이블 차단', true, (e as Error).message) }

try {
  await withUser(A, (db) => runQuery(db, {
    table: 'orders', select: '*', filters: [{ column: "id') or true--", op: 'eq', value: 1 }],
  }))
  check('알 수 없는 컬럼 차단', false)
} catch (e) { check('알 수 없는 컬럼 차단', true, (e as Error).message) }

console.log(`\n  ${pass}/${pass + fail} 통과`)
await withAdmin(async (db) => {
  await db.query(RESET)
})
await appPool.end(); await adminPool.end()
process.exit(fail ? 1 : 0)
