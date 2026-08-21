import { sign } from '../src/jwt.ts'
import { withAdmin, appPool, adminPool } from '../src/db.ts'

const API = 'https://api.shop.lkim.me'
const admin = sign({ sub: '3af2c4cd-d623-4531-b915-0e10ec22f304', role: 'authenticated' })
const rpc = (n: string, b: unknown) => fetch(`${API}/rpc/${n}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
  body: JSON.stringify(b),
}).then(async r => [r.status, await r.json()] as [number, any])

let pass = 0, fail = 0
const t = (l: string, ok: boolean, d = '') => { ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l.padEnd(38)}${d}`) }

const TESTNAME = '[검증]테스트농원'

const appId: string = await withAdmin(async db => (await db.query(
  `insert into farm_applications (user_id, farm_name, owner_name, phone, location, product_summary,
     description, bank_name, account_number, account_holder, status)
   values ($1,$2,'검증담당','01000000000','경기 검증시','검증용','검증용 신청','농협','1234567890','검증','pending')
   returning id`, ['a0000000-0000-4000-8000-000000000001', TESTNAME])).rows[0].id)
console.log(`  검증용 신청 생성: ${appId}`)

let [s, b] = await rpc('approve-farm', { applicationId: appId, action: 'approve' })
t('농가 승인', s === 200 && !!b.farmId, `농가 ${b.farmId ?? b.error}`)
const farmId: string | undefined = b.farmId

if (farmId) {
  const chk = await withAdmin(async db => ({
    farm: (await db.query('select name, slug, is_active from farms where id=$1', [farmId])).rows[0],
    mem: (await db.query('select member_role from farm_members where farm_id=$1', [farmId])).rows[0],
    app: (await db.query('select status, farm_id from farm_applications where id=$1', [appId])).rows[0],
  }))
  t('  농가 생성됨', chk.farm?.name === TESTNAME, `slug=${chk.farm?.slug}`)
  t('  소유자가 구성원으로', chk.mem?.member_role === 'owner')
  t('  신청 상태 approved', chk.app?.status === 'approved' && chk.app?.farm_id === farmId)
  ;[s, b] = await rpc('approve-farm', { applicationId: appId, action: 'approve' })
  t('  중복 승인 차단', !!b.error, b.error)
}

const orderId: string = await withAdmin(async db => (await db.query(
  "select id from orders where status in ('paid','packing') limit 1")).rows[0].id)
const before: number = await withAdmin(async db => (await db.query(
  'select count(*)::int n from shipments where order_id=$1', [orderId])).rows[0].n)
;[s, b] = await rpc('kpost-shipment', { orderIds: [orderId] })
t('송장 초안 생성', s === 200 && b.count === 1, String(b.message ?? b.error).slice(0, 30) + '…')
const after: number = await withAdmin(async db => (await db.query(
  'select count(*)::int n from shipments where order_id=$1', [orderId])).rows[0].n)
t('  shipments 행 추가됨', after === before + 1, `${before} → ${after}`)

// 검증용으로 만든 행만 정리한다
const cleaned = await withAdmin(async db => {
  await db.query(`select set_config('request.jwt.claims','{"role":"service_role"}',false)`)
  const a = await db.query(
    `delete from shipments where order_id=$1 and status='draft' and request_payload::text like '%stub%'`, [orderId])
  const m = farmId ? await db.query('delete from farm_members where farm_id=$1', [farmId]) : { rowCount: 0 }
  const f = farmId ? await db.query('delete from farms where id=$1', [farmId]) : { rowCount: 0 }
  const p = await db.query('delete from farm_applications where id=$1', [appId])
  return { 송장초안: a.rowCount, 구성원: m.rowCount, 농가: f.rowCount, 신청: p.rowCount }
})
console.log('\n  정리한 검증용 행:', JSON.stringify(cleaned))
const left = await withAdmin(async db => (await db.query('select count(*)::int n from farms')).rows[0].n)
console.log(`  농가 수: ${left} (7이어야 정상)`)
console.log(`\n  ${pass}/${pass + fail} 통과`)
await appPool.end(); await adminPool.end()
