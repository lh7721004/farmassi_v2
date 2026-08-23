import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, CircleAlert, Plus } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input, Textarea } from '../../components/ui/Field'
import { PhoneField } from '../../components/ui/PhoneField'
import { ErrorText, PageSpinner } from '../../components/ui/Feedback'
import { AddressPicker } from '../../components/shared/AddressPicker'
import { BankdaAccountLink } from '../../components/shared/BankdaAccountLink'
import {
  AccountPicker,
  BankField,
  profileLabel,
  type ProfileOption,
} from '../../components/shared/FarmContractFields'
import { adminNavItems } from '../../config/adminNav'
import { farmLandingPath } from '../../lib/farmShareText'
import { toSlug } from '../../lib/slug'
import { supabase } from '../../lib/supabase'
import { parseLandingBlocks, type Farm } from '../../types/models'

/**
 * 농가와 계약할 때 필요한 일을 한 화면에서 끝낸다.
 *
 * 농가 등록 → 담당 계정 연결 → 입금 계좌 등록 → 상품 → 랜딩까지, 무엇이 끝났고
 * 무엇이 남았는지 한눈에 보이게 한다. 각 항목은 실제 데이터를 보고 판단하므로
 * "했다고 생각했는데 안 된" 상태가 드러난다.
 */

interface Step {
  id: string
  title: string
  done: boolean
  detail: string
  action?: { label: string; to: string }
  render?: () => React.ReactNode
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  location: '',
  product_summary: '',
  description: '',
  phone: '',
  mobile_phone: '',
  address: '',
  address_zonecode: '',
  address_detail: '',
  bank_name: '',
  account_number: '',
  account_holder: '',
  owner_user_id: '',
}

export function AdminContract() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('farm') ?? ''

  const [farms, setFarms] = useState<Farm[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [productCounts, setProductCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    const [farmRes, profileRes, productRes] = await Promise.all([
      supabase.from('farms').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name, phone, avatar_url'),
      supabase.from('products').select('id, farm_id, sale_status'),
    ])
    setFarms((farmRes.data as Farm[]) ?? [])
    setProfiles((profileRes.data as ProfileOption[]) ?? [])
    const counts: Record<string, number> = {}
    for (const row of (productRes.data as { farm_id: string; sale_status: string }[]) ?? []) {
      if (row.sale_status === 'on_sale') counts[row.farm_id] = (counts[row.farm_id] ?? 0) + 1
    }
    setProductCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const farm = useMemo(() => farms.find((f) => f.id === selectedId) ?? null, [farms, selectedId])
  const profilesById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  )

  async function createFarm() {
    setError('')
    if (!form.name.trim()) return setError('농가명을 입력하세요.')
    if (!form.owner_user_id) return setError('담당 계정을 선택하세요.')
    if (!form.bank_name.trim() || !form.account_number.trim() || !form.account_holder.trim()) {
      return setError('입금 계좌 정보를 모두 입력하세요.')
    }

    setPending(true)
    try {
      const taken = new Set(farms.map((f) => f.slug))
      let slug = toSlug(form.slug.trim() || form.name) || 'farm'
      if (taken.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 8)}`

      const { data, error: insertError } = await supabase
        .from('farms')
        .insert({
          slug,
          name: form.name.trim(),
          owner_user_id: form.owner_user_id,
          location: form.location.trim() || null,
          product_summary: form.product_summary.trim() || null,
          description: form.description.trim() || null,
          phone: form.phone.trim() || null,
          mobile_phone: form.mobile_phone.trim() || null,
          address: form.address.trim() || null,
          address_zonecode: form.address_zonecode.trim() || null,
          address_detail: form.address_detail.trim() || null,
          bank_name: form.bank_name.trim(),
          account_number: form.account_number.trim(),
          account_holder: form.account_holder.trim(),
        })
        .select('id')
        .single()

      if (insertError || !data) {
        setError(insertError?.message ?? '농가를 만들지 못했습니다.')
        return
      }

      // 담당자를 농가 구성원으로도 넣어야 농가 화면에 들어갈 수 있다.
      await supabase
        .from('farm_members')
        .insert({ farm_id: data.id, user_id: form.owner_user_id, member_role: 'owner' })

      setForm(EMPTY_FORM)
      setCreating(false)
      await load()
      setParams({ farm: data.id })
    } finally {
      setPending(false)
    }
  }

  if (loading) return <PageSpinner />

  const steps: Step[] = farm
    ? [
        {
          id: 'info',
          title: '기본 정보',
          done: Boolean(farm.location && farm.description && (farm.phone || farm.mobile_phone) && farm.address),
          detail: [
            farm.location ? null : '지역',
            farm.description ? null : '소개',
            farm.phone || farm.mobile_phone ? null : '연락처',
            farm.address ? null : '주소',
          ]
            .filter(Boolean)
            .join(', ') || '지역·소개·연락처·주소 모두 입력됨',
          action: { label: '농가 수정', to: '/admin/farms' },
        },
        {
          id: 'owner',
          title: '담당 계정',
          done: Boolean(farm.owner_user_id),
          detail: profileLabel(profilesById.get(farm.owner_user_id)),
          action: { label: '계정 연결', to: '/admin/farms' },
        },
        {
          id: 'bank',
          title: '입금 계좌',
          done: Boolean(farm.account_number),
          detail: `${farm.bank_name} ${farm.account_number} · 예금주 ${farm.account_holder}`,
          render: () => <BankdaAccountLink farmId={farm.id} farmName={farm.name} />,
        },
        {
          id: 'products',
          title: '판매 상품',
          done: (productCounts[farm.id] ?? 0) > 0,
          detail: `판매 중 ${productCounts[farm.id] ?? 0}개`,
          action: { label: '상품 관리', to: `/admin/farms/${farm.id}/products` },
        },
        {
          id: 'landing',
          title: '랜딩·공유 문구',
          done: parseLandingBlocks(farm.landing_blocks).length > 0 && Boolean(farm.share_text),
          detail: `랜딩 블록 ${parseLandingBlocks(farm.landing_blocks).length}개 · 공유 문구 ${
            farm.share_text ? '있음' : '없음'
          }`,
          action: { label: '랜딩 보기', to: farmLandingPath(farm.slug) },
        },
        {
          id: 'open',
          title: '공개 상태',
          done: farm.is_active,
          detail: farm.is_active
            ? farm.is_listed
              ? '공개 중이고 메인 목록에도 나옵니다'
              : '공개 중이지만 메인 목록에는 안 나옵니다 (주소로만 접근)'
            : '비활성 상태라 주문을 받을 수 없습니다',
          action: { label: '농가 관리', to: '/admin/farms' },
        },
      ]
    : []

  const doneCount = steps.filter((s) => s.done).length

  return (
    <AppShell navItems={adminNavItems} roleLabel="관리자" settingsPath="/admin/none">
      <Header title="계약 진행" subtitle="농가와 계약할 때 필요한 것들" />
      <div className="px-4 py-4 md:px-6 max-w-3xl mx-auto space-y-4">
        {error && <ErrorText>{error}</ErrorText>}

        <Card className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">농가 선택</p>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={selectedId}
            onChange={(e) => {
              setCreating(false)
              e.target.value ? setParams({ farm: e.target.value }) : setParams({})
            }}
          >
            <option value="">선택하세요</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.is_active ? '' : ' (비활성)'}
              </option>
            ))}
          </select>
          {!creating && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCreating(true)
                setParams({})
              }}
            >
              <Plus className="h-4 w-4" />
              새 농가 계약 시작
            </Button>
          )}
        </Card>

        {creating && (
          <Card className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">새 농가</p>
            <Input
              label="농가명"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <Input
              label="주문 페이지 주소"
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: toSlug(e.target.value) }))}
              placeholder="비워두면 농가명에서 자동 생성"
            />
            <p className="text-xs text-muted">/farm/{toSlug(form.slug || form.name) || '...'}</p>
            <Input
              label="지역"
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            />
            <Input
              label="주요 품목"
              value={form.product_summary}
              onChange={(e) => setForm((p) => ({ ...p, product_summary: e.target.value }))}
            />
            <Textarea
              label="소개"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
            <PhoneField
              label="전화번호"
              value={form.phone}
              onChange={(phone) => setForm((p) => ({ ...p, phone }))}
            />
            <PhoneField
              label="휴대폰"
              value={form.mobile_phone}
              onChange={(mobile_phone) => setForm((p) => ({ ...p, mobile_phone }))}
            />
            <AddressPicker
              value={{
                zonecode: form.address_zonecode,
                address: form.address,
                addressDetail: form.address_detail,
              }}
              onChange={(next) =>
                setForm((p) => ({
                  ...p,
                  address_zonecode: next.zonecode,
                  address: next.address,
                  address_detail: next.addressDetail,
                }))
              }
            />
            <BankField
              value={form.bank_name}
              onChange={(bank_name) => setForm((p) => ({ ...p, bank_name }))}
              required
            />
            <Input
              label="계좌"
              value={form.account_number}
              onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))}
              required
            />
            <Input
              label="예금주"
              value={form.account_holder}
              onChange={(e) => setForm((p) => ({ ...p, account_holder: e.target.value }))}
              required
            />
            <AccountPicker
              profiles={profiles}
              selectedId={form.owner_user_id}
              onSelect={(id) => setForm((p) => ({ ...p, owner_user_id: id }))}
            />
            <p className="text-xs text-muted">
              계좌는 여기 적어두는 것이고, 입금 자동확인은 농가를 만든 뒤 아래에서 등록 링크를
              보내야 시작됩니다.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => void createFarm()}>
                {pending ? '만드는 중…' : '농가 만들기'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                취소
              </Button>
            </div>
          </Card>
        )}

        {farm && (
          <>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">{farm.name}</p>
                <p className="text-xs text-muted">/farm/{farm.slug}</p>
              </div>
              <p className="text-sm font-semibold text-primary">
                {doneCount} / {steps.length} 완료
              </p>
            </Card>

            {steps.map((step) => (
              <Card key={step.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  {step.done ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                    <p className={`text-xs ${step.done ? 'text-muted' : 'text-amber-700'}`}>
                      {step.done ? step.detail : `남은 항목: ${step.detail}`}
                    </p>
                  </div>
                  {step.action && (
                    <Link
                      to={step.action.to}
                      className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary"
                    >
                      {step.action.label}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                {step.render?.()}
              </Card>
            ))}

            <Button fullWidth variant="outline" onClick={() => navigate(`/admin/farms/${farm.id}`)}>
              이 농가 관리 화면으로
            </Button>
          </>
        )}
      </div>
    </AppShell>
  )
}
