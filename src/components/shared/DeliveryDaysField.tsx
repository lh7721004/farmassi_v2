import { Field } from '../ui/Field'
import { WEEKDAYS, normalizeDeliveryDays } from '../../lib/deliveryDays'

interface DeliveryDaysFieldProps {
  value: number[]
  onChange: (days: number[]) => void
}

/**
 * 배송 가능 요일 체크박스.
 *
 * 아무것도 고르지 않은 상태를 그대로 둔다 — '설정 안 함' 이 유효한 값이라
 * 강제로 하나를 고르게 하지 않는다.
 */
export function DeliveryDaysField({ value, onChange }: DeliveryDaysFieldProps) {
  const selected = new Set(normalizeDeliveryDays(value))

  const toggle = (day: number) => {
    const next = new Set(selected)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    onChange([...next].sort((a, b) => a - b))
  }

  return (
    <Field label="배송 가능 요일 *">
      <div className="mt-1 flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => {
          const on = selected.has(day.value)
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day.value)}
              className={`h-9 w-9 rounded-full border text-sm transition ${
                on
                  ? 'border-primary bg-primary text-white font-semibold'
                  : 'border-gray-200 bg-white text-muted hover:border-gray-300'
              }`}
            >
              {day.label}
            </button>
          )
        })}
      </div>
      <p className={`mt-1.5 text-xs ${selected.size === 0 ? 'text-red-600' : 'text-muted'}`}>
        {selected.size === 0
          ? '하나 이상 골라 주세요. 예상 배송일 계산에 쓰입니다.'
          : '주문 페이지에 예상 배송일이 표시됩니다.'}
      </p>
    </Field>
  )
}
