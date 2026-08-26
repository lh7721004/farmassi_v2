import type { OrderStatus } from './models'

export interface OrderListModel {
  id: string
  customerName: string
  customerPhone?: string | null
  productSummary: string
  amount: number
  address: string
  status: OrderStatus
  orderDate: string
  trackingNumber?: string | null
  memo?: string | null
  orderNo?: string
  /**
   * 주문자가 적어 낸 나머지. 카드에 다 펼치면 목록을 훑을 수가 없어서
   * '주문자 작성 정보' 안에 접어 둔다.
   */
  senderName?: string | null
  senderPhone?: string | null
  senderAddress?: string | null
  depositorName?: string | null
  itemsAmount?: number
  shippingFee?: number
  depositDueAmount?: number
  depositCode?: string | null
}
