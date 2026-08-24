export type ProfileRole = 'customer' | 'admin'
export type FarmMemberRole = 'owner' | 'staff'
export type OrderStatus =
  | 'pending_deposit'
  | 'paid'
  | 'packing'
  | 'shipping'
  | 'completed'
  | 'cancelled'
export type NotificationType = 'order_created' | 'deposit_confirmed' | 'shipment_requested'
export type DepositProvider = 'manual' | 'gnd' | 'hecto' | 'banksalad' | 'codef' | 'bankda'
export type ShipmentStatus = 'draft' | 'requested' | 'printed' | 'cancelled'
export type MatchStatus = 'unmatched' | 'matched' | 'ignored'
export type ProductSaleStatus = 'on_sale' | 'coming_soon' | 'sold_out' | 'hidden' | 'inquiry'

export const PRODUCT_SALE_STATUS_OPTIONS: { value: ProductSaleStatus; label: string }[] = [
  { value: 'on_sale', label: '판매중' },
  { value: 'coming_soon', label: '판매 예정' },
  { value: 'sold_out', label: '품절' },
  { value: 'inquiry', label: '별도 문의' },
  { value: 'hidden', label: '숨김' },
]

export const PRODUCT_SALE_STATUS_LABEL: Record<ProductSaleStatus, string> = {
  on_sale: '판매중',
  coming_soon: '판매 예정',
  sold_out: '품절',
  inquiry: '별도 문의',
  hidden: '숨김',
}

export interface Profile {
  id: string
  role: ProfileRole
  display_name: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface FarmLandingBlock {
  id: string
  image_url: string | null
  body: string
}

export function parseLandingBlocks(value: unknown): FarmLandingBlock[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const body = typeof row.body === 'string' ? row.body : ''
    const image_url = typeof row.image_url === 'string' && row.image_url.trim() ? row.image_url : null
    if (!body.trim() && !image_url) return []
    const id = typeof row.id === 'string' && row.id ? row.id : `block-${index}`
    return [{ id, image_url, body }]
  })
}

export interface Farm {
  id: string
  slug: string
  name: string
  owner_user_id: string
  location: string | null
  product_summary: string | null
  description: string | null
  kakao_channel_url: string | null
  phone: string | null
  mobile_phone: string | null
  address: string | null
  address_zonecode: string | null
  address_detail: string | null
  map_url: string | null
  share_text: string | null
  landing_blocks: FarmLandingBlock[]
  bank_name: string
  account_number: string
  account_holder: string
  is_active: boolean
  /** 메인 농가 목록 노출 여부. false 여도 slug 주소로는 들어갈 수 있다. */
  is_listed: boolean
  /** 배송 가능 요일 (0=일 … 6=토). 빈 배열이면 설정 안 함. */
  delivery_days: number[]
  /** 배송 일시정지 기간. 둘 다 비어 있으면 정지 없음. */
  shipping_pause_start: string | null
  shipping_pause_end: string | null
  shipping_pause_reason: string | null
  created_at: string
  updated_at: string
}

export interface FarmMember {
  farm_id: string
  user_id: string
  member_role: FarmMemberRole
  created_at: string
}

export interface Product {
  id: string
  farm_id: string
  name: string
  /** 실제로 받는 금액. 주문 금액 계산은 전부 이 값을 쓴다. */
  price: number
  /** 할인 전 원래 가격. price 보다 클 때만 취소선으로 표시한다. */
  list_price: number | null
  unit: string | null
  description: string | null
  image_url: string | null
  is_active: boolean
  sale_status: ProductSaleStatus
  sort_order: number
  parcel_weight_kg: string
  parcel_volume_cm: string
  parcel_content_code: string
  parcel_delivery_type: string
  created_at: string
  updated_at: string
}

export function productSaleStatus(product: Pick<Product, 'sale_status' | 'is_active'>): ProductSaleStatus {
  return product.sale_status ?? (product.is_active ? 'on_sale' : 'hidden')
}

export function isProductOrderable(product: Pick<Product, 'sale_status' | 'is_active'>) {
  return productSaleStatus(product) === 'on_sale'
}

export interface SavedAddress {
  id: string
  user_id: string
  recipient_name: string
  phone: string
  zonecode: string | null
  address: string
  address_detail: string | null
  is_default: boolean
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_no: string
  farm_id: string
  customer_id: string
  status: OrderStatus
  recipient_name: string
  recipient_phone: string
  zonecode: string | null
  address: string
  address_detail: string | null
  request_memo: string | null
  total_amount: number
  deposit_due_amount: number
  deposit_code: string
  deposit_confirmed_at: string | null
  deposit_confirmed_by: string | null
  deposit_provider: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  unit: string | null
  unit_price: number
  quantity: number
  line_amount: number
  product?: Pick<Product, 'parcel_weight_kg' | 'parcel_volume_cm' | 'parcel_content_code' | 'parcel_delivery_type'> | null
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
  farm?: Farm | null
}

export interface AppNotification {
  id: string
  user_id: string
  farm_id: string | null
  order_id: string | null
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  created_at: string
}

export interface Shipment {
  id: string
  order_id: string
  provider: string
  status: ShipmentStatus
  tracking_number: string | null
  request_payload: Record<string, unknown> | null
  response_payload: Record<string, unknown> | null
  requested_at: string | null
  created_at: string
  updated_at: string
}

export interface DepositTransaction {
  id: string
  farm_id: string | null
  provider: DepositProvider
  occurred_at: string
  amount: number
  depositor_name: string | null
  raw_payload: Record<string, unknown> | null
  matched_order_id: string | null
  match_status: MatchStatus
  created_at: string
}
