import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Header } from '../../components/layout/Header'
import { AddressPicker, type AddressValue } from '../../components/shared/AddressPicker'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PhoneField } from '../../components/ui/PhoneField'
import { adminNavItems } from '../../config/adminNav'
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

interface ManualParcelRow {
  id: string
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

/** 엑셀 헤더색: 파란=필수, 노란=선택 */
function ExcelLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <span
        className={[
          'inline-block h-2.5 w-2.5 shrink-0 rounded-sm border',
          required ? 'border-[#7eb3e8] bg-[#99CCFF]' : 'border-[#e6e6a8] bg-[#FFFFCC]',
        ].join(' ')}
        aria-hidden
      />
      <span className="text-gray-700">{label}</span>
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
  children,
}: {
  label: string
  required: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <ExcelLabel label={label} required={required} />
      {children}
    </label>
  )
}

export function AdminShippingManual() {
  const [rows, setRows] = useState<ManualParcelRow[]>(() => [newRow()])

  function update(id: string, patch: Partial<ManualParcelRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)))
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

        {rows.map((row, index) => {
          const splitOn = row.split === 'Y'
          return (
            <Card key={row.id} className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900">접수 {index + 1}</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={rows.length <= 1}
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </Button>
              </div>

              <ExcelField label="받는 분" required>
                <input
                  className={`${inputClass} ${tint(true)}`}
                  value={row.recipientName}
                  onChange={(e) => update(row.id, { recipientName: e.target.value })}
                  placeholder="홍길동"
                />
              </ExcelField>

              <div className="space-y-2">
                <ExcelLabel label="주소 · 우편번호 · 상세주소" required />
                <div className={`rounded-xl border border-gray-200 p-3 ${tint(true)}`}>
                  <AddressPicker
                    value={row.address}
                    onChange={(address) => update(row.id, { address })}
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
                    value={row.landline}
                    onChange={(e) => update(row.id, { landline: e.target.value })}
                    placeholder="02-1234-5678"
                  />
                </ExcelField>
                <ExcelField label="휴대전화(010-1234-5678)" required>
                  <div className={`mt-1 rounded-xl ${tint(true)} px-1 py-0.5`}>
                    <PhoneField
                      label=""
                      value={row.mobile}
                      onChange={(mobile) => update(row.id, { mobile })}
                      required
                    />
                  </div>
                </ExcelField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ExcelField label="중량(kg)" required>
                  <select
                    className={`${inputClass} ${tint(true)}`}
                    value={row.weightKg}
                    onChange={(e) => update(row.id, { weightKg: e.target.value })}
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
                    value={row.volumeCm}
                    onChange={(e) => update(row.id, { volumeCm: e.target.value })}
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
                    value={row.contentCode}
                    onChange={(e) => update(row.id, { contentCode: e.target.value })}
                  >
                    {KPOST_CONTENT_CODES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </ExcelField>
                <ExcelField label="배달방식" required={false}>
                  <select
                    className={`${inputClass} ${tint(false)}`}
                    value={row.deliveryType}
                    onChange={(e) => update(row.id, { deliveryType: e.target.value })}
                  >
                    {KPOST_DELIVERY_TYPES.map((value) => (
                      <option key={value || 'none'} value={value}>
                        {value || '미입력'}
                      </option>
                    ))}
                  </select>
                </ExcelField>
              </div>

              <ExcelField label="내용물" required={false}>
                <input
                  className={`${inputClass} ${tint(false)}`}
                  value={row.contents}
                  onChange={(e) => update(row.id, { contents: e.target.value })}
                  placeholder="밤고구마 5kg"
                />
              </ExcelField>

              <ExcelField label="배송시요청사항" required={false}>
                <textarea
                  className={`${inputClass} min-h-20 resize-y ${tint(false)}`}
                  value={row.requestMemo}
                  onChange={(e) => update(row.id, { requestMemo: e.target.value })}
                  placeholder="문 앞에 놓아주세요"
                />
              </ExcelField>

              <ExcelField label="분할접수 여부(Y/N)" required>
                <select
                  className={`${inputClass} ${tint(true)}`}
                  value={row.split}
                  onChange={(e) => {
                    const split = e.target.value as SplitFlag
                    update(row.id, {
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

              <div className="grid gap-3 sm:grid-cols-2">
                <ExcelField label="분할접수 첫번째 중량(kg)" required>
                  <select
                    className={`${inputClass} ${tint(true)}`}
                    value={row.splitWeight1}
                    disabled={!splitOn}
                    onChange={(e) => update(row.id, { splitWeight1: e.target.value })}
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
                    value={row.splitVolume1}
                    disabled={!splitOn}
                    onChange={(e) => update(row.id, { splitVolume1: e.target.value })}
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
                    value={row.splitWeight2}
                    disabled={!splitOn}
                    onChange={(e) => update(row.id, { splitWeight2: e.target.value })}
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
                    value={row.splitVolume2}
                    disabled={!splitOn}
                    onChange={(e) => update(row.id, { splitVolume2: e.target.value })}
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
            </Card>
          )
        })}

        <Button type="button" variant="outline" fullWidth onClick={() => setRows((prev) => [...prev, newRow()])}>
          <Plus className="h-4 w-4" />
          접수 추가
        </Button>

        <Button type="button" fullWidth disabled title="UI만 — 저장·내보내기 없음">
          엑셀로 내보내기 (미연결)
        </Button>
      </div>
    </AppShell>
  )
}
