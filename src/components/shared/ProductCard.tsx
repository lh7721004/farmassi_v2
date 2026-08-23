import { Minus, Plus } from 'lucide-react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  PRODUCT_SALE_STATUS_LABEL,
  productSaleStatus,
  type Product,
} from '../../types/models'
import { productGradient } from '../../lib/format'
import { PriceTag } from './PriceTag'
import { Card } from '../ui/Card'

interface ProductCardProps {
  product: Product
  quantity?: number
  onChangeQuantity?: (quantity: number) => void
  extra?: ReactNode
}

const MIN_TITLE_PX = 11

function FitTwoLineTitle({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      el.style.fontSize = ''
      const computed = getComputedStyle(el)
      const baseSize = parseFloat(computed.fontSize)
      const lineHeightPx = Number.isFinite(parseFloat(computed.lineHeight))
        ? parseFloat(computed.lineHeight)
        : baseSize * 1.375
      const boxHeight = lineHeightPx * 2
      el.style.height = `${boxHeight}px`
      let size = baseSize
      while (el.scrollHeight > boxHeight + 0.5 && size > MIN_TITLE_PX) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
    }

    fit()
    const parent = el.parentElement
    if (!parent) return undefined
    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [text])

  return (
    <h3 ref={ref} className="overflow-hidden break-words font-bold leading-snug text-gray-900">
      {text}
    </h3>
  )
}

export function ProductCard({ product, quantity = 0, onChangeQuantity, extra }: ProductCardProps) {
  const status = productSaleStatus(product)
  const badge = status === 'on_sale' ? null : PRODUCT_SALE_STATUS_LABEL[status]
  const canOrder = status === 'on_sale'

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="relative h-36 shrink-0">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} draggable={false} className="h-full w-full object-cover" />
        ) : (
          <div className={`h-full bg-gradient-to-br ${productGradient(product.id)}`} />
        )}
        {badge && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900">{badge}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <FitTwoLineTitle text={product.name} />
        <p className="mt-2 text-lg font-bold text-primary">
          <PriceTag price={product.price} listPrice={product.list_price} />
        </p>
        {extra}
        {!extra && onChangeQuantity && canOrder && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted">수량</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200"
                onClick={() => onChangeQuantity(Math.max(0, quantity - 1))}
                aria-label="수량 감소"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200"
                onClick={() => onChangeQuantity(quantity + 1)}
                aria-label="수량 증가"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
