import { withAdmin, appPool, adminPool } from '../src/db.ts'

const API = 'http://127.0.0.1:4310'
let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const post = (path: string, body: unknown, token?: string) =>
  fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).then((r) => r.json() as any)

// --- 준비 ---
let farmId = '', productId = '', userA = '', userB = ''
await withAdmin(async (db) => {
  await db.query(`delete from shipments; delete from order_items; delete from orders;
    delete from products; delete from farm_members; delete from farms;
    delete from deposit_transactions; delete from notifications; delete from saved_addresses;`)
  userA = (await db.query(`select id from auth.users where email='a@e.com'`)).rows[0].id
  userB = (await db.query(`select id from auth.users where email='b@e.com'`)).rows[0].id
  await db.query(`update profiles set role='admin' where id=$1`, [userB])
  farmId = (await db.query(`insert into farms (slug,name,owner_user_id,bank_name,account_number,account_holder)
    values ('haneul','하늘농원',$1,'농협','3522405606253','박지훈') returning id`, [userB])).rows[0].id
  await db.query(`insert into farm_members (farm_id,user_id,member_role) values ($1,$2,'owner')`, [farmId, userB])
  productId = (await db.query(`insert into products (farm_id,name,price,unit)
    values ($1,'꿀사과 5kg',25000,'박스') returning id`, [farmId])).rows[0].id
})

const tokenA = (await post('/auth/dev-login', { email: 'a@e.com' })).token
const tokenB = (await post('/auth/dev-login', { email: 'b@e.com' })).token

// --- 1. 주문 생성 ---
const created = await post('/rpc/create-order', {
  farmId,
  items: [{ productId, quantity: 2 }],
  recipient: { name: '김이현', phone: '01011112222', address: '서울시 강남구', zonecode: '06236' },
  saveAddress: true,
}, tokenA)
check('create-order 성공', Boolean(created.orderId), JSON.stringify(created))
const orderId = created.orderId

const row = await withAdmin(async (db) =>
  (await db.query(`select order_no, total_amount, deposit_code, status from orders where id=$1`, [orderId])).rows[0])
check('금액 계산 (25000 x 2)', row?.total_amount === 50000, `total=${row?.total_amount}`)
check('주문번호 형식', /^FA\d{8}-[A-Z2-9]{4}$/.test(row?.order_no ?? ''), row?.order_no)
check('입금코드 6자리', /^[A-Z2-9]{6}$/.test(row?.deposit_code ?? ''), row?.deposit_code)
check('초기 상태 pending_deposit', row?.status === 'pending_deposit')

const extras = await withAdmin(async (db) => ({
  items: (await db.query('select * from order_items where order_id=$1', [orderId])).rows,
  saved: (await db.query('select * from saved_addresses where user_id=$1', [userA])).rows,
  notes: (await db.query('select * from notifications where order_id=$1', [orderId])).rows,
}))
check('품목 저장', extras.items.length === 1 && extras.items[0].line_amount === 50000)
check('주소 저장 (saveAddress)', extras.saved.length === 1 && extras.saved[0].address === '서울시 강남구')
check('농가에 알림 생성', extras.notes.length === 1 && extras.notes[0].type === 'order_created')

// --- 2. 품절 상품은 주문 불가 ---
await withAdmin((db) => db.query(`update products set sale_status='sold_out' where id=$1`, [productId]))
const blocked = await post('/rpc/create-order', {
  farmId, items: [{ productId, quantity: 1 }],
  recipient: { name: '김이현', phone: '01011112222', address: '서울시 강남구' },
}, tokenA)
check('품절 상품 주문 차단', blocked.error === '판매 중인 상품만 주문할 수 있습니다.', blocked.error)
await withAdmin((db) => db.query(`update products set sale_status='on_sale' where id=$1`, [productId]))

// --- 3. 고객 조회 (임베드) ---
const listed = await post('/query', {
  table: 'orders',
  select: 'order_no, deposit_due_amount, order_items(product_name, quantity), farms(name)',
}, tokenA)
const o = listed.data?.[0]
check('임베드 조회', o?.order_items?.[0]?.quantity === 2 && o?.farms?.name === '하늘농원',
  `items=${o?.order_items?.length} farm=${o?.farms?.name}`)

// --- 4. 입금 확인 ---
const confirmed = await post('/rpc/confirm-deposit', { orderId }, tokenB)
check('confirm-deposit 성공', confirmed.ok === true, JSON.stringify(confirmed))
const after = await withAdmin(async (db) => ({
  order: (await db.query('select status, deposit_provider from orders where id=$1', [orderId])).rows[0],
  tx: (await db.query('select amount, match_status from deposit_transactions where matched_order_id=$1', [orderId])).rows[0],
}))
check('주문 상태 paid', after.order?.status === 'paid', after.order?.status)
check('입금 기록 생성', after.tx?.amount === 50000 && after.tx?.match_status === 'matched')

// --- 5. 이미 확인된 주문 재확인 차단 ---
const again = await post('/rpc/confirm-deposit', { orderId }, tokenB)
check('중복 입금확인 차단', again.error === '입금 대기 주문이 아닙니다.', again.error)

// --- 6. 고객은 입금확인 불가 ---
const denied = await post('/rpc/confirm-deposit', { orderId }, tokenA)
check('고객의 입금확인 차단', denied.error === '관리자만 입금을 확인할 수 있습니다.', denied.error)

console.log(`\n  ${pass}/${pass + fail} 통과`)
await appPool.end(); await adminPool.end()
process.exit(fail ? 1 : 0)
