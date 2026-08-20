import { sb } from '../sb.ts'
import { isAdmin, randomCode } from '../shared/util.ts'
import { fail, ok, type FnHandler } from './types.ts'

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '')
  return `${base || 'farm'}-${randomCode(6).toLowerCase()}`
}

export const approveFarm: FnHandler = async ({ userId, body, admin }) => {
  if (!userId) return fail('로그인이 필요합니다.', 401)
  if (!(await isAdmin(admin, userId))) return fail('관리자만 처리할 수 있습니다.', 403)
  if (!body?.applicationId || !body?.action) return fail('잘못된 요청입니다.')

  const db = sb(admin)
  const { data: application } = await db.from('farm_applications').select('*')
    .eq('id', body.applicationId).maybeSingle()
  if (!application) return fail('신청을 찾을 수 없습니다.', 404)
  if (application.status !== 'pending') return fail('이미 처리된 신청입니다.')

  const review = {
    review_note: body.reviewNote ?? null,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }

  if (body.action === 'reject') {
    const { error } = await db.from('farm_applications')
      .update({ status: 'rejected', ...review }).eq('id', application.id)
    if (error) return fail(error.message)
    return ok()
  }

  const { data: farm, error: farmError } = await db.from('farms').insert({
    slug: slugify(application.farm_name),
    name: application.farm_name,
    owner_user_id: application.user_id,
    location: application.location,
    product_summary: application.product_summary,
    description: application.description,
    bank_name: application.bank_name,
    account_number: application.account_number,
    account_holder: application.account_holder,
    is_active: true,
  }).select('id').single()
  if (farmError || !farm) return fail(farmError?.message ?? '농가 생성 실패')

  const { error: memberError } = await db.from('farm_members')
    .insert({ farm_id: farm.id, user_id: application.user_id, member_role: 'owner' })
  if (memberError) return fail(memberError.message)

  await db.from('farm_applications')
    .update({ status: 'approved', ...review, farm_id: farm.id }).eq('id', application.id)

  // Supabase 에서는 auth 사용자의 app_metadata 에 is_farm 을 찍었다. 로컬에서도 같은 자리에 남긴다.
  await admin.query(
    `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"is_farm":true}'::jsonb where id = $1`,
    [application.user_id],
  ).catch(() => {})

  return ok({ farmId: farm.id })
}
