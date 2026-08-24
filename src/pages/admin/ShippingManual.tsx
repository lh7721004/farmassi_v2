import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Sparkles, Trash2 } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Header } from '../../components/layout/Header'
import { AddressPicker, type AddressValue } from '../../components/shared/AddressPicker'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PhoneField } from '../../components/ui/PhoneField'
import { adminNavItems } from '../../config/adminNav'
import { digitsOnly, formatPhone } from '../../lib/phone'
import {
  KPOST_CONTENT_CODES,
  KPOST_DELIVERY_TYPES,
  KPOST_VOLUMES,
  KPOST_WEIGHTS,
  defaultParcelExcelOptions,
  kpostVolumeLabel,
  kpostWeightLabel,
} from '../../lib/kpostParcelExcel'

/**
 * 우체국 창구소포 엑셀과 같은 직접작성 화면.
 * UI·로컬 상태만. 저장·엑셀 내보내기·주문 연동 없음.
 */

type SplitFlag = 'Y' | 'N'
type OrderChannel = '직접연락' | '카톡 비즈니스'

const ORDER_CHANNELS: { value: OrderChannel; label: string }[] = [
  { value: '직접연락', label: '직접연락' },
  { value: '카톡 비즈니스', label: '카톡주문' },
]

interface DummyFarm {
  id: string
  name: string
}

interface DummyProduct {
  id: string
  name: string
  weightKg: string
  volumeCm: string
  contentCode: string
  deliveryType: string
}

/** 화면용 더미 농가·상품 (실제 DB 연동 없음) */
const DUMMY_FARMS: DummyFarm[] = [
  { id: 'jooyoung', name: '주영농원' },
  { id: 'takine', name: '탁이네 농원' },
  { id: 'jinyoung', name: '진영농원' },
]

const DUMMY_PRODUCTS: Record<string, DummyProduct[]> = {
  jooyoung: [
    {
      id: 'jy-peach',
      name: '복숭아 2kg',
      weightKg: '5',
      volumeCm: '80',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
    {
      id: 'jy-grape',
      name: '캠벨포도 2kg',
      weightKg: '5',
      volumeCm: '80',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
    {
      id: 'jy-apple',
      name: '사과 5kg',
      weightKg: '10',
      volumeCm: '100',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
  ],
  takine: [
    {
      id: 'tk-plum',
      name: '자두 2kg',
      weightKg: '5',
      volumeCm: '80',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
    {
      id: 'tk-peach',
      name: '백도복숭아 2kg',
      weightKg: '5',
      volumeCm: '80',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
    {
      id: 'tk-tomato',
      name: '방울토마토 1kg',
      weightKg: '3',
      volumeCm: '80',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
  ],
  jinyoung: [
    {
      id: 'jn-pear',
      name: '배 5kg',
      weightKg: '10',
      volumeCm: '100',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
    {
      id: 'jn-persimmon',
      name: '단감 5kg',
      weightKg: '10',
      volumeCm: '100',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
    {
      id: 'jn-chestnut',
      name: '밤 2kg',
      weightKg: '5',
      volumeCm: '80',
      contentCode: '농/수/축산물(일반)',
      deliveryType: '',
    },
  ],
}

interface ManualParcelRow {
  id: string
  farmId: string
  productId: string
  orderChannel: OrderChannel
  recipientName: string
  address: AddressValue
  landline: string
  mobile: string
  weightKg: string
  volumeCm: string
  contentCode: string
  contents: string
  deliveryType: string
  requestMemo: string
  split: SplitFlag
  splitWeight1: string
  splitVolume1: string
  splitWeight2: string
  splitVolume2: string
}

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-gray-50 disabled:text-muted'

function newRow(): ManualParcelRow {
  return {
    id: crypto.randomUUID(),
    farmId: DUMMY_FARMS[0]?.id ?? '',
    productId: '',
    orderChannel: '직접연락',
    recipientName: '',
    address: { zonecode: '', address: '', addressDetail: '' },
    landline: '',
    mobile: '',
    weightKg: defaultParcelExcelOptions.weightKg,
    volumeCm: defaultParcelExcelOptions.volumeCm,
    contentCode: defaultParcelExcelOptions.contentCode,
    contents: '',
    deliveryType: defaultParcelExcelOptions.deliveryType,
    requestMemo: '',
    split: 'N',
    splitWeight1: '',
    splitVolume1: '',
    splitWeight2: '',
    splitVolume2: '',
  }
}

function cloneRow(row: ManualParcelRow): ManualParcelRow {
  return {
    ...row,
    address: { ...row.address },
  }
}

function isDirty(draft: ManualParcelRow, baseline: ManualParcelRow): boolean {
  const a = { ...draft, id: '' }
  const b = { ...baseline, id: '' }
  return JSON.stringify(a) !== JSON.stringify(b)
}

function channelLabel(channel: OrderChannel) {
  return ORDER_CHANNELS.find((c) => c.value === channel)?.label ?? channel
}

function farmName(farmId: string) {
  return DUMMY_FARMS.find((f) => f.id === farmId)?.name ?? farmId
}

function applyProduct(product: DummyProduct): Partial<ManualParcelRow> {
  return {
    productId: product.id,
    contents: product.name,
    weightKg: product.weightKg,
    volumeCm: product.volumeCm,
    contentCode: product.contentCode,
    deliveryType: product.deliveryType,
  }
}

function ExcelLabel({ label, required, ai }: { label: string; required: boolean; ai?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <span
        className={[
          'inline-block h-2.5 w-2.5 shrink-0 rounded-sm border',
          required ? 'border-[#7eb3e8] bg-[#99CCFF]' : 'border-[#e6e6a8] bg-[#FFFFCC]',
        ].join(' ')}
        aria-hidden
      />
      <span className="inline-flex items-center gap-1 text-gray-700">
        {label}
        {ai ? <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden /> : null}
      </span>
      {required ? <span className="text-[10px] font-semibold text-red-500">필수</span> : null}
    </span>
  )
}

function tint(required: boolean) {
  return required ? 'bg-[#99CCFF]/20' : 'bg-[#FFFFCC]/50'
}

function ExcelField({
  label,
  required,
  ai,
  children,
}: {
  label: string
  required: boolean
  ai?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <ExcelLabel label={label} required={required} ai={ai} />
      {children}
    </label>
  )
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  cols?: 2 | 3
}) {
  return (
    <div className={`mt-1 grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map((opt) => {
        const on = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors',
              on
                ? 'border-primary bg-primary-light text-primary'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            ].join(' ')}
            aria-pressed={on}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function AdminShippingManual() {
  const [draft, setDraft] = useState<ManualParcelRow>(() => newRow())
  const [baseline, setBaseline] = useState<ManualParcelRow>(() => cloneRow(draft))
  const [entries, setEntries] = useState<ManualParcelRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingLoadId, setPendingLoadId] = useState<string | null>(null)
  const [bulkPaste, setBulkPaste] = useState('')
  const [mobilePaste, setMobilePaste] = useState('')

  const splitOn = draft.split === 'Y'
  const dirty = isDirty(draft, baseline)
  const farmProducts = DUMMY_PRODUCTS[draft.farmId] ?? []
  const selectedProduct = farmProducts.find((p) => p.id === draft.productId)

  function patchDraft(patch: Partial<ManualParcelRow>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function applyBulkPaste(raw: string) {
    setBulkPaste(raw)
    // TODO: parse and auto-fill recipient, address, phone, product, etc.
  }

  function applyMobilePaste(raw: string) {
    const digits = digitsOnly(raw)
    if (digits.length < 9) {
      setMobilePaste(raw)
      return
    }
    patchDraft({ mobile: formatPhone(raw) })
    setMobilePaste('')
  }

  function selectFarm(farmId: string) {
    if (farmId === draft.farmId) return
    patchDraft({
      farmId,
      productId: '',
      contents: '',
      weightKg: defaultParcelExcelOptions.weightKg,
      volumeCm: defaultParcelExcelOptions.volumeCm,
      contentCode: defaultParcelExcelOptions.contentCode,
      deliveryType: defaultParcelExcelOptions.deliveryType,
    })
  }

  function selectProduct(product: DummyProduct) {
    patchDraft(applyProduct(product))
  }

  function clearDraft() {
    const next = newRow()
    setDraft(next)
    setBaseline(cloneRow(next))
    setEditingId(null)
  }

  function loadEntry(entry: ManualParcelRow) {
    const next = cloneRow(entry)
    setDraft(next)
    setBaseline(cloneRow(next))
    setEditingId(entry.id)
    setPendingLoadId(null)
  }

  function requestLoadEntry(id: string) {
    if (editingId === id) return
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    if (dirty) {
      setPendingLoadId(id)
      return
    }
    loadEntry(entry)
  }

  function confirmDiscardAndLoad() {
    if (!pendingLoadId) return
    const entry = entries.find((e) => e.id === pendingLoadId)
    if (entry) loadEntry(entry)
    else setPendingLoadId(null)
  }

  function addFromDraft() {
    const snapshot = cloneRow(draft)
    if (editingId) {
      setEntries((prev) => prev.map((e) => (e.id === editingId ? { ...snapshot, id: editingId } : e)))
    } else {
      setEntries((prev) => [...prev, snapshot])
    }
    clearDraft()
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    if (editingId === id) clearDraft()
  }

  return (
    <AppShell navItems={adminNavItems} roleLabel="관리자" settingsPath="/admin/none">
      <Header
        title="직접작성"
        subtitle="창구소포 파일접수 양식 · UI만 (저장 없음)"
        showBack
        backTo="/admin/shipments"
      />
      <div className="px-4 py-4 md:px-6 max-w-3xl mx-auto space-y-4">
        <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-[#7eb3e8] bg-[#99CCFF]" />
            파란색 = 필수
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-[#e6e6a8] bg-[#FFFFCC]" />
            노란색 = 선택
          </span>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900">
              {editingId ? '접수 수정' : '새 접수'}
            </h3>
            {editingId && (
              <Button type="button" size="sm" variant="ghost" onClick={clearDraft}>
                새 접수로
              </Button>
            )}
          </div>

          <ExcelField label="농가" required>
            <select
              className={`${inputClass} ${tint(true)}`}
              value={draft.farmId}
              onChange={(e) => selectFarm(e.target.value)}
            >
              {DUMMY_FARMS.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </ExcelField>

          <div>
            <ExcelLabel label="주문 구분" required />
            <ToggleGroup
              options={ORDER_CHANNELS}
              value={draft.orderChannel}
              onChange={(orderChannel) => patchDraft({ orderChannel })}
            />
          </div>

          <ExcelField label="전체 붙여넣기" required={false} ai>
            <textarea
              className={`${inputClass} min-h-16 resize-y ${tint(false)}`}
              value={bulkPaste}
              onChange={(e) => applyBulkPaste(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text')
                if (!text.trim()) return
                e.preventDefault()
                applyBulkPaste(text)
              }}
              placeholder="주문 정보 붙여넣기 (이름, 주소, 연락처 등)"
              aria-label="전체 붙여넣기"
            />
          </ExcelField>

          <ExcelField label="받는 분" required>
            <input
              className={`${inputClass} ${tint(true)}`}
              value={draft.recipientName}
              onChange={(e) => patchDraft({ recipientName: e.target.value })}
              placeholder="홍길동"
            />
          </ExcelField>

          <div className="space-y-2">
            <ExcelLabel label="주소 · 우편번호 · 상세주소" required />
            <div className={`rounded-xl border border-gray-200 p-3 ${tint(true)}`}>
              <AddressPicker
                value={draft.address}
                onChange={(address) => patchDraft({ address })}
                emptyHint="받는 분 주소를 검색해 주세요"
                detailLabel="상세주소(동, 호수, 아파트, 건물명 등)"
                detailPlaceholder="동·호수, 공동현관 비밀번호 등"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ExcelField label="일반전화(02-1234-5678)" required={false}>
              <input
                type="tel"
                className={`${inputClass} ${tint(false)}`}
                value={draft.landline}
                onChange={(e) => patchDraft({ landline: e.target.value })}
                placeholder="02-1234-5678"
              />
            </ExcelField>
            <ExcelField label="휴대전화(010-1234-5678)" required>
              <div className="mt-1 space-y-2">
                <input
                  type="tel"
                  className={`${inputClass} !mt-0 ${tint(false)}`}
                  value={mobilePaste}
                  onChange={(e) => applyMobilePaste(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text')
                    if (digitsOnly(text).length < 9) return
                    e.preventDefault()
                    applyMobilePaste(text)
                  }}
                  placeholder="붙여넣기 (01012345678)"
                  aria-label="휴대전화 붙여넣기"
                />
                <div className={`rounded-xl ${tint(true)} px-1 py-0.5`}>
                  <PhoneField
                    label=""
                    value={draft.mobile}
                    onChange={(mobile) => patchDraft({ mobile })}
                    required
                  />
                </div>
              </div>
            </ExcelField>
          </div>

          <ExcelField label="배달방식" required={false}>
            <select
              className={`${inputClass} ${tint(false)}`}
              value={draft.deliveryType}
              onChange={(e) => patchDraft({ deliveryType: e.target.value })}
            >
              {KPOST_DELIVERY_TYPES.map((value) => (
                <option key={value || 'none'} value={value}>
                  {value || '미입력'}
                </option>
              ))}
            </select>
          </ExcelField>

          <ExcelField label="배송시요청사항" required={false}>
            <textarea
              className={`${inputClass} min-h-20 resize-y ${tint(false)}`}
              value={draft.requestMemo}
              onChange={(e) => patchDraft({ requestMemo: e.target.value })}
              placeholder="문 앞에 놓아주세요"
            />
          </ExcelField>

          <div>
            <ExcelLabel label="상품" required />
            <div className="mt-1 space-y-2">
              {farmProducts.length === 0 ? (
                <p className="text-sm text-muted">선택한 농가에 등록된 상품이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {farmProducts.map((product) => (
                    <li
                      key={product.id}
                      className={[
                        'flex items-center gap-3 rounded-2xl border p-2.5',
                        draft.productId === product.id
                          ? 'border-primary bg-primary-light/40'
                          : 'border-gray-100 bg-white',
                      ].join(' ')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{product.name}</p>
                        <p className="truncate text-xs text-muted">
                          {kpostWeightLabel(product.weightKg)} · {kpostVolumeLabel(product.volumeCm)} ·{' '}
                          {product.contentCode}
                        </p>
                      </div>
                      <Button type="button" size="sm" onClick={() => selectProduct(product)}>
                        선택
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!selectedProduct && (
              <p className="mt-2 text-xs text-amber-700">
                상품을 선택하면 중량·부피·내용품·내용물이 채워집니다. 없으면 아래를 열어 직접 입력하세요.
              </p>
            )}
          </div>

          <details className="rounded-xl border border-gray-200 bg-gray-50/60 open:bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-gray-800">
              <span>상품에 없는 경우 · 중량·부피·내용품·내용물 직접 입력</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
            </summary>
            <div className="space-y-3 border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-muted">
                목록에 없는 물품일 때만 열어 직접 입력하세요. 값을 바꾸면 상품 선택이 해제됩니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ExcelField label="중량(kg)" required>
                  <select
                    className={`${inputClass} ${tint(true)}`}
                    value={draft.weightKg}
                    onChange={(e) => patchDraft({ productId: '', weightKg: e.target.value })}
                  >
                    {KPOST_WEIGHTS.map((value) => (
                      <option key={value} value={value}>
                        {kpostWeightLabel(value)}
                      </option>
                    ))}
                  </select>
                </ExcelField>
                <ExcelField label="부피(cm)=가로+세로+높이" required>
                  <select
                    className={`${inputClass} ${tint(true)}`}
                    value={draft.volumeCm}
                    onChange={(e) => patchDraft({ productId: '', volumeCm: e.target.value })}
                  >
                    {KPOST_VOLUMES.map((value) => (
                      <option key={value} value={value}>
                        {kpostVolumeLabel(value)}
                      </option>
                    ))}
                  </select>
                </ExcelField>
                <ExcelField label="내용품코드" required>
                  <select
                    className={`${inputClass} ${tint(true)}`}
                    value={draft.contentCode}
                    onChange={(e) => patchDraft({ productId: '', contentCode: e.target.value })}
                  >
                    {KPOST_CONTENT_CODES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </ExcelField>
              </div>
              <ExcelField label="내용물" required={false}>
                <input
                  className={`${inputClass} ${tint(false)}`}
                  value={draft.contents}
                  onChange={(e) => patchDraft({ productId: '', contents: e.target.value })}
                  placeholder="밤고구마 5kg"
                />
              </ExcelField>
            </div>
          </details>

          <ExcelField label="분할접수 여부(Y/N)" required>
            <select
              className={`${inputClass} ${tint(true)}`}
              value={draft.split}
              onChange={(e) => {
                const split = e.target.value as SplitFlag
                patchDraft({
                  split,
                  ...(split === 'N'
                    ? {
                        splitWeight1: '',
                        splitVolume1: '',
                        splitWeight2: '',
                        splitVolume2: '',
                      }
                    : {}),
                })
              }}
            >
              <option value="N">N</option>
              <option value="Y">Y</option>
            </select>
          </ExcelField>

          {splitOn && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ExcelField label="분할접수 첫번째 중량(kg)" required>
                <select
                  className={`${inputClass} ${tint(true)}`}
                  value={draft.splitWeight1}
                  onChange={(e) => patchDraft({ splitWeight1: e.target.value })}
                >
                  <option value="">-</option>
                  {KPOST_WEIGHTS.map((value) => (
                    <option key={value} value={value}>
                      {kpostWeightLabel(value)}
                    </option>
                  ))}
                </select>
              </ExcelField>
              <ExcelField label="분할접수 첫번째 부피(cm)" required>
                <select
                  className={`${inputClass} ${tint(true)}`}
                  value={draft.splitVolume1}
                  onChange={(e) => patchDraft({ splitVolume1: e.target.value })}
                >
                  <option value="">-</option>
                  {KPOST_VOLUMES.map((value) => (
                    <option key={value} value={value}>
                      {kpostVolumeLabel(value)}
                    </option>
                  ))}
                </select>
              </ExcelField>
              <ExcelField label="분할접수 두번째 중량(kg)" required>
                <select
                  className={`${inputClass} ${tint(true)}`}
                  value={draft.splitWeight2}
                  onChange={(e) => patchDraft({ splitWeight2: e.target.value })}
                >
                  <option value="">-</option>
                  {KPOST_WEIGHTS.map((value) => (
                    <option key={value} value={value}>
                      {kpostWeightLabel(value)}
                    </option>
                  ))}
                </select>
              </ExcelField>
              <ExcelField label="분할접수 두번째 부피(cm)" required>
                <select
                  className={`${inputClass} ${tint(true)}`}
                  value={draft.splitVolume2}
                  onChange={(e) => patchDraft({ splitVolume2: e.target.value })}
                >
                  <option value="">-</option>
                  {KPOST_VOLUMES.map((value) => (
                    <option key={value} value={value}>
                      {kpostVolumeLabel(value)}
                    </option>
                  ))}
                </select>
              </ExcelField>
            </div>
          )}
        </Card>

        <Button type="button" variant="outline" fullWidth onClick={addFromDraft}>
          확인
        </Button>

        {entries.length > 0 && (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="font-semibold text-gray-900">추가된 접수 {entries.length}건</h3>
              <p className="mt-0.5 text-xs text-muted">줄을 누르면 작성창에 불러옵니다.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">농가</th>
                    <th className="px-3 py-2 font-medium">구분</th>
                    <th className="px-3 py-2 font-medium">받는 분</th>
                    <th className="px-3 py-2 font-medium">휴대전화</th>
                    <th className="px-3 py-2 font-medium">내용물</th>
                    <th className="px-3 py-2 font-medium w-12" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const active = editingId === entry.id
                    return (
                      <tr
                        key={entry.id}
                        className={[
                          'border-t border-gray-50 cursor-pointer',
                          active ? 'bg-primary-light/50' : 'hover:bg-gray-50',
                        ].join(' ')}
                        onClick={() => requestLoadEntry(entry.id)}
                      >
                        <td className="px-3 py-2.5 tabular-nums text-muted">{index + 1}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {farmName(entry.farmId)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {channelLabel(entry.orderChannel)}
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {entry.recipientName || '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted">
                          {entry.mobile || '—'}
                        </td>
                        <td className="px-3 py-2.5 max-w-[140px] truncate text-muted">
                          {entry.contents || '—'}
                        </td>
                        <td className="px-2 py-2.5">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-red-600"
                            aria-label="삭제"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeEntry(entry.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {entries.length === 0 ? (
          <Button type="button" fullWidth disabled>
            송장 페이지로 내보내기
          </Button>
        ) : (
          <Link to="/admin/shipments" className="block">
            <Button type="button" fullWidth>
              송장 페이지로 내보내기
            </Button>
          </Link>
        )}
      </div>

      <ConfirmDialog
        open={pendingLoadId !== null}
        title="작성 중인 내용을 지울까요?"
        description="표에서 다른 접수를 불러오면 지금 작성창에 입력한 내용이 사라집니다."
        confirmLabel="지우고 불러오기"
        cancelLabel="취소"
        onConfirm={confirmDiscardAndLoad}
        onCancel={() => setPendingLoadId(null)}
      />
    </AppShell>
  )
}
