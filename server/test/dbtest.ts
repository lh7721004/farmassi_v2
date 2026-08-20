import { withUser, withAdmin, appPool, adminPool } from '../src/db.ts'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

await withAdmin(async (db) => {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
    ($1,'a@example.com','{"nickname":"김이현"}'), ($2,'b@example.com','{"nickname":"박지훈"}')
    on conflict do nothing`, [A, B])
})

const seenByA = await withUser(A, async (db) =>
  (await db.query('select display_name from public.profiles')).rows.map(r => r.display_name))
const seenByB = await withUser(B, async (db) =>
  (await db.query('select display_name from public.profiles')).rows.map(r => r.display_name))
const seenByAnon = await withUser(null, async (db) =>
  (await db.query('select display_name from public.profiles')).rows.map(r => r.display_name))
const seenByAdmin = await withAdmin(async (db) =>
  (await db.query('select display_name from public.profiles order by display_name')).rows.map(r => r.display_name))

// 커넥션 재사용 시 이전 사용자 컨텍스트가 남는지 확인
const leakCheck = await withUser(null, async (db) =>
  (await db.query("select current_setting('request.jwt.claim.sub', true) as sub")).rows[0].sub)

console.log('  A 가 보는 프로필    :', seenByA)
console.log('  B 가 보는 프로필    :', seenByB)
console.log('  비로그인이 보는 것  :', seenByAnon)
console.log('  admin 이 보는 것    :', seenByAdmin)
console.log('  컨텍스트 잔존 여부  :', leakCheck === null || leakCheck === '' ? '없음 (정상)' : `남음! ${leakCheck}`)

await withAdmin(async (db) => { await db.query('delete from auth.users') })
await appPool.end(); await adminPool.end()
