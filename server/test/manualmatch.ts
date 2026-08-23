import { sign } from '../src/jwt.ts'
import { withAdmin, appPool, adminPool } from '../src/db.ts'

const API = 'https://api.shop.lkim.me'
const admin = sign({ sub: '3af2c4cd-d623-4531-b915-0e10ec22f304', role: 'authenticated' })
const H = { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }
const rpc = (n: string, b: unknown) =>
  fetch(`${API}/rpc/${n}`, { method: 'POST', headers: H, body: JSON.stringify(b) })
    .then(async (r) => [r.status, await r.json()] as [number, any])

let pass = 0, fail = 0
const t = (l: string, ok: boolean, d = '') => { ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l.padEnd(40)}${d}`) }

const FARM = 'b0000000-0000-4000-8000-000000000001'

// 김철수 이름으로 25,000원 주문
const orderId: string = await withAdmin(async (db) => (await db.query(
  `insert into orders (order_no, farm_id, customer_id, recipient_name, recipient_phone,
     address, total_amount, deposit_due_amount, deposit_code, status)
   values ('FA-MANUAL-TEST', $1, $2, '김철수', '01011112222', '서울 강남구',
           25000, 25000, 'MTEST1', 'pending_deposit') returning id`,
  [FARM, 'a0000000-0000-4000-8000-000000000001'])).rows[0].id)

// 고길동이 입금 — 이름이 달라 자동으로 안 붙는 상황
const depositId: string = await withAdmin(async (db) => (await db.query(
  `insert into deposit_transactions (farm_id, provider, external_id, occurred_at, amount,
     depositor_name, raw_payload, match_status)
   values ($1, 'bankda', 'MANUAL-TEST-1', now(), 25000, '고길동',
           '{"source":"bankda","match_reason":"ambiguous"}', 'unmatched') returning id`,
  [FARM])).rows[0].id)
console.log(`  준비: 주문 FA-MANUAL-TEST(김철수 25,000원) / 입금 고길동 25,000원\n`)

// 1. 수동 연결
let [s, b] = await rpc('match-deposit', { action: 'match', depositId, orderId })
t('수동 연결', s === 200 && b.orderNo === 'FA-MANUAL-TEST', `금액일치=${b.amountMatches}`)

let state = await withAdmin(async (db) => ({
  order: (await db.query('select status, deposit_provider from orders where id=$1', [orderId])).rows[0],
  dep: (await db.query('select match_status, matched_order_id, raw_payload from deposit_transactions where id=$1', [depositId])).rows[0],
  noti: (await db.query(`select count(*)::int n from notifications where order_id=$1 and type='deposit_confirmed'`, [orderId])).rows[0].n,
}))
t('  주문이 결제완료로', state.order?.status === 'paid', state.order?.status)
t('  입금이 matched 로', state.dep?.match_status === 'matched')
t('  수동 처리 기록 남음', state.dep?.raw_payload?.matched_manually === true)
t('  농가에 알림', state.noti === 1)

// 2. 같은 주문에 다른 입금을 또 붙이려 하면 막혀야 한다
const dep2: string = await withAdmin(async (db) => (await db.query(
  `insert into deposit_transactions (farm_id, provider, external_id, occurred_at, amount,
     depositor_name, match_status)
   values ($1,'bankda','MANUAL-TEST-2', now(), 25000, '홍길동', 'unmatched') returning id`,
  [FARM])).rows[0].id)
;[s, b] = await rpc('match-deposit', { action: 'match', depositId: dep2, orderId })
t('이미 연결된 주문 중복 차단', !!b.error, b.error)

// 3. 연결 해제하면 주문이 다시 입금대기로
;[s, b] = await rpc('match-deposit', { action: 'unmatch', depositId })
state = await withAdmin(async (db) => ({
  order: (await db.query('select status from orders where id=$1', [orderId])).rows[0],
  dep: (await db.query('select match_status, matched_order_id from deposit_transactions where id=$1', [depositId])).rows[0],
}))
t('연결 해제', s === 200 && state.order?.status === 'pending_deposit', state.order?.status)
t('  입금도 unmatched 로', state.dep?.match_status === 'unmatched' && !state.dep?.matched_order_id)

// 4. 금액이 달라도 연결된다 (입금자명·금액 둘 다 어긋난 경우)
await withAdmin((db) => db.query('update deposit_transactions set amount=24000 where id=$1', [depositId]))
;[s, b] = await rpc('match-deposit', { action: 'match', depositId, orderId })
t('금액이 달라도 연결 가능', s === 200 && b.amountMatches === false, `금액일치=${b.amountMatches}`)

// 5. 무시 처리
;[s, b] = await rpc('match-deposit', { action: 'ignore', depositId: dep2 })
const ig = await withAdmin(async (db) => (await db.query('select match_status from deposit_transactions where id=$1', [dep2])).rows[0])
t('주문과 무관 처리', ig?.match_status === 'ignored')

// 6. 권한
const anon = await fetch(`${API}/rpc/match-deposit`, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ depositId }) }).then((r) => r.json())
t('비로그인 차단', !!anon.error, anon.error)

// 정리
await withAdmin(async (db) => {
  await db.query(`select set_config('request.jwt.claims','{"role":"service_role"}',false)`)
  await db.query('delete from notifications where order_id=$1', [orderId])
  await db.query('delete from deposit_transactions where external_id like $1', ['MANUAL-TEST-%'])
  await db.query('delete from orders where id=$1', [orderId])
})
console.log('\n  검증용 데이터 정리됨')
console.log(`  ${pass}/${pass + fail} 통과`)
await appPool.end(); await adminPool.end()
process.exit(fail ? 1 : 0)
