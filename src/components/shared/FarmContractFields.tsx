import { useMemo, useState } from 'react'
import { Input, Select } from '../ui/Field'
import type { Profile } from '../../types/models'

// admin/Farms.tsx 안에만 있던 것을 계약 페이지에서도 쓰려고 꺼냈다.

export type ProfileOption = Pick<Profile, 'id' | 'display_name' | 'phone' | 'avatar_url'>

const BANK_CUSTOM = '__custom__'
const BANKS = [
  '국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  'NH농협은행',
  '기업은행',
  '카카오뱅크',
  '토스뱅크',
  '케이뱅크',
  '부산은행',
  'iM뱅크',
  '경남은행',
  '광주은행',
  '전북은행',
  '제주은행',
  '수협은행',
  'SC제일은행',
  '한국씨티은행',
  '산업은행',
  '우체국',
  '새마을금고',
  '신협',
] as const

export function BankField({
  value,
  onChange,
  required,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  const listed = BANKS.includes(value as (typeof BANKS)[number])
  const selectValue = listed ? value : BANK_CUSTOM

  return (
    <div className="space-y-2">
      <Select
        label="은행"
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value
          if (next === BANK_CUSTOM) {
            onChange(listed ? '' : value)
            return
          }
          onChange(next)
        }}
        required={required}
      >
        <option value={BANK_CUSTOM}>직접입력</option>
        {BANKS.map((bank) => (
          <option key={bank} value={bank}>
            {bank}
          </option>
        ))}
      </Select>
      {selectValue === BANK_CUSTOM && (
        <Input
          label="은행명"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="은행명을 입력하세요"
          required={required}
        />
      )}
    </div>
  )
}

export function profileLabel(profile: ProfileOption | undefined) {
  if (!profile) return '미지정'
  const name = profile.display_name?.trim() || '이름 없음'
  return profile.phone ? `${name} · ${profile.phone}` : name
}

export function AccountPicker({
  profiles,
  selectedId,
  onSelect,
  label = '담당 계정',
}: {
  profiles: ProfileOption[]
  selectedId: string
  onSelect: (id: string) => void
  label?: string
}) {
  const [query, setQuery] = useState('')
  const selected = profiles.find((p) => p.id === selectedId)
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const list = q
      ? profiles.filter((p) => {
          const name = (p.display_name ?? '').toLowerCase()
          const phone = (p.phone ?? '').replace(/\s/g, '')
          const id = p.id.toLowerCase()
          return name.includes(q) || phone.includes(q.replace(/\s/g, '')) || id.includes(q)
        })
      : profiles
    return list.slice(0, 8)
  }, [profiles, q])

  return (
    <div className="space-y-2">
      <Input
        label={label}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름, 연락처, 또는 계정 ID"
      />
      {selected && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-light px-3 py-2 text-sm">
          <span className="font-medium text-primary">{profileLabel(selected)}</span>
          <button type="button" className="text-xs text-muted" onClick={() => onSelect('')}>
            해제
          </button>
        </div>
      )}
      {matches.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
          {matches.map((profile: ProfileOption) => (
            <li key={profile.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  profile.id === selectedId ? 'bg-primary-light font-medium' : ''
                }`}
                onClick={() => {
                  onSelect(profile.id)
                  setQuery('')
                }}
              >
                {profileLabel(profile)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">{q ? '일치하는 계정이 없습니다.' : '카카오로 로그인한 계정 목록입니다.'}</p>
      )}
    </div>
  )
}
