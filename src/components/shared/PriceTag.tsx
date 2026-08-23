import { formatPrice } from '../../lib/format'

interface PriceTagProps {
  /** 실제로 받는 금액 */
  price: number
  /** 할인 전 원래 가격. price 보다 클 때만 취소선으로 함께 보여준다. */
  listPrice?: number | null
  className?: string
  /** 할인율 배지를 붙일지. 목록처럼 좁은 곳에서는 끈다. */
  showRate?: boolean
}

export function discountRate(price: number, listPrice?: number | null): number | null {
  if (!listPrice || listPrice <= price) return null
  return Math.round(((listPrice - price) / listPrice) * 100)
}

/**
 * 가격 표시.
 *
 * 할인이 없으면 지금까지와 똑같이 금액 하나만 나온다. list_price 가 price 보다
 * 클 때만 취소선과 배지가 붙는다 — 잘못 입력된 값(원래가격 ≤ 판매가)으로 이상한
 * 할인이 표시되지 않게 하려는 것이다.
 */
export function PriceTag({ price, listPrice, className = '', showRate = true }: PriceTagProps) {
  const rate = discountRate(price, listPrice)

  if (rate === null) {
    return <span className={className}>{formatPrice(price)}</span>
  }

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${className}`}>
      <span className="text-muted line-through decoration-1">{formatPrice(listPrice!)}</span>
      <span>{formatPrice(price)}</span>
      {showRate && (
        <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-600">
          {rate}%
        </span>
      )}
    </span>
  )
}
