import { Minus, Plus } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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

function FitOneLineTitle({ text }: { text: string }) {
  const wrapRef = useRef<HTMLHeadingElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [marquee, setMarquee] = useState(false)
  const [duration, setDuration] = useState(8)
  const [shift, setShift] = useState(0)

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const measure = measureRef.current
    if (!wrap || !measure) return

    const fit = () => {
      wrap.style.fontSize = ''
      const baseSize = parseFloat(getComputedStyle(wrap).fontSize)
      let size = baseSize
      wrap.style.fontSize = `${size}px`
      const available = wrap.clientWidth
      while (measure.scrollWidth > available + 0.5 && size > MIN_TITLE_PX) {
        size -= 0.5
        wrap.style.fontSize = `${size}px`
      }
      const overflowPx = measure.scrollWidth - available
      const overflow = overflowPx > 0.5
      setMarquee(overflow)
      if (overflow) {
        setShift(overflowPx)
        setDuration(Math.max(5, overflowPx / 28))
      }
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [text])

  return (
    <h3
      ref={wrapRef}
      className="relative overflow-hidden whitespace-nowrap font-bold leading-snug text-gray-900"
    >
      <span ref={measureRef} className="invisible absolute whitespace-nowrap" aria-hidden>
        {text}
      </span>
      {marquee ? (
        <span
          className="product-title-marquee inline-block"
          style={{
            ['--marquee-duration' as string]: `${duration}s`,
            ['--marquee-shift' as string]: `${shift}px`,
          }}
        >
          {text}
        </span>
      ) : (
        text
      )}
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
        <FitOneLineTitle text={product.name} />
        {product.description?.trim() ? (
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm leading-snug text-muted">
            {product.description.trim()}
          </p>
        ) : null}
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-primary">
            <PriceTag price={product.price} listPrice={product.list_price} />
          </span>
          <span className="text-xs text-muted">배송비 포함</span>
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
