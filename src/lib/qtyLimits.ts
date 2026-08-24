import type { Farm, Product } from '../types/models'
import type { CartItem } from './cart'

/** 물량 초과 시 일정 카드·모달에 쓰는 공통 문구. */
export const QTY_VOLUME_WARNING = '현재 주문 물량 증가로 예상배송일정을 확인해주세요'

export interface TodayQty {
  farmQty: number
  byProduct: Record<string, number>
}

export function emptyTodayQty(): TodayQty {
  return { farmQty: 0, byProduct: {} }
}

function limitOrDefault(value: number | null | undefined) {
  return typeof value === 'number' && value >= 1 ? value : 100
}

/**
 * 장바구니 + 오늘 기존 주문이 한도를 넘는지.
 * 넘어도 주문은 막지 않고 경고만 한다.
 */
export function isQtyVolumeExceeded(args: {
  farm: Pick<Farm, 'daily_qty_limit'>
  products: Pick<Product, 'id' | 'daily_qty_limit' | 'per_order_qty_limit'>[]
  cart: CartItem[]
  today: TodayQty
}) {
  const cartTotal = args.cart.reduce((sum, item) => sum + item.quantity, 0)
  const farmLimit = limitOrDefault(args.farm.daily_qty_limit)
  if (args.today.farmQty + cartTotal > farmLimit) return true

  for (const item of args.cart) {
    if (item.quantity <= 0) continue
    const product = args.products.find((row) => row.id === item.productId)
    if (!product) continue
    if (item.quantity > limitOrDefault(product.per_order_qty_limit)) return true
    const todayProduct = args.today.byProduct[item.productId] ?? 0
    if (todayProduct + item.quantity > limitOrDefault(product.daily_qty_limit)) return true
  }
  return false
}
