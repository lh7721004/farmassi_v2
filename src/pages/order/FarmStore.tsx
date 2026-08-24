import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { useLoginSheet } from '../../components/auth/LoginSheet'
import { FarmInquiryButtons } from '../../components/shared/KakaoChannelButton'
import { ProductCard } from '../../components/shared/ProductCard'
import { ShippingScheduleNotice } from '../../components/shared/ShippingScheduleNotice'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSpinner } from '../../components/ui/Feedback'
import { getCart, setCart, type CartItem } from '../../lib/cart'
import { formatPrice, kakaoChannelHref } from '../../lib/format'
import { activeShippingPause } from '../../lib/shippingPause'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { isProductOrderable, type Farm, type Product } from '../../types/models'

export function FarmStore() {
  const { farmSlug = '' } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { openLogin } = useLoginSheet()
  const [farm, setFarm] = useState<Farm | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCartState] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setCartState(getCart(farmSlug))
    async function load() {
      // 비활성 농가도 화면은 열어 준다. 주문만 막는다(아래 orderingClosed).
      const { data: farmRow } = await supabase.from('farms').select('*').eq('slug', farmSlug).maybeSingle()
      if (!farmRow) {
        setFarm(null)
        setLoading(false)
        return
      }
      const farmData = farmRow as Farm
      setFarm(farmData)
      const { data: productRows } = await supabase
        .from('products')
        .select('*')
        .eq('farm_id', farmData.id)
        .eq('is_active', true)
        .order('sort_order')
      setProducts((productRows as Product[]) ?? [])
      setLoading(false)
    }
    void load()
  }, [farmSlug])

  // 농가가 비활성이거나 배송 정지 중이면 담기·주문을 막는다. 구경과 문의는 그대로 가능하다.
  const pause = activeShippingPause(farm)
  const orderingClosed = Boolean(farm && (!farm.is_active || pause))

  const qtyById = useMemo(() => Object.fromEntries(cart.map((item) => [item.productId, item.quantity])), [cart])
  const selected = products.filter((product) => isProductOrderable(product) && (qtyById[product.id] ?? 0) > 0)
  const selectedCount = selected.reduce((sum, product) => sum + (qtyById[product.id] ?? 0), 0)
  const total = selected.reduce((sum, product) => sum + product.price * (qtyById[product.id] ?? 0), 0)

  function updateQty(productId: string, quantity: number) {
    const product = products.find((item) => item.id === productId)
    if (product && !isProductOrderable(product)) return
    const next = cart.filter((item) => item.productId !== productId)
    if (quantity > 0) next.push({ productId, quantity })
    setCart(farmSlug, next)
    setCartState(next)
  }

  const kakaoHref = kakaoChannelHref(farm?.kakao_channel_url)
  const hasInquiry = Boolean(kakaoHref || farm?.phone?.trim() || farm?.mobile_phone?.trim())

  if (loading) return <PageSpinner />
  if (!farm) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted">
        농가를 찾을 수 없습니다
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface pb-28">
      <Header
        title={farm.name}
        subtitle={farm.location || BRAND_SUB}
        showBack
        backTo={`/farm/${farmSlug}/landingpage`}
        rightElement={
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link to="/admin/farms" className="text-sm font-medium text-muted hover:text-gray-900">
                관리자 페이지
              </Link>
            )}
            <button
              type="button"
              className="text-sm font-medium text-primary"
              onClick={() => {
                if (user) navigate('/me/orders')
                else openLogin({ next: '/me/orders' })
              }}
            >
              내 주문
            </button>
          </div>
        }
      />
      <div className="px-4 py-4 md:px-6 max-w-5xl mx-auto space-y-4">
        {hasInquiry ? (
          <FarmInquiryButtons
            kakaoChannelUrl={farm.kakao_channel_url}
            phone={farm.phone}
            mobilePhone={farm.mobile_phone}
          />
        ) : (farm.description || farm.product_summary) ? (
          <Card>
            <p className="text-sm text-gray-700">{farm.description || farm.product_summary}</p>
          </Card>
        ) : null}
        <ShippingScheduleNotice days={farm.delivery_days} farm={farm} />
        {products.length === 0 ? (
          <p className="text-center text-muted py-10">판매 중인 상품이 없습니다</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={qtyById[product.id] ?? 0}
                onChangeQuantity={orderingClosed ? undefined : (qty) => updateQty(product.id, qty)}
              />
            ))}
          </div>
        )}
      </div>
      {orderingClosed && (
        <div className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {pause ? '배송 일시정지 중입니다' : '지금은 주문을 받지 않습니다'}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {pause
              ? '상품과 농가 정보는 그대로 보실 수 있습니다. 정지 기간이 지나면 다시 주문할 수 있습니다.'
              : '상품과 농가 정보는 그대로 보실 수 있습니다. 주문은 잠시 멈춰 있습니다.'}
          </p>
        </div>
      )}
      {!orderingClosed && selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white p-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted">{selectedCount}개 선택</p>
              <p className="font-bold text-primary">{formatPrice(total)}</p>
            </div>
            <Button
              size="lg"
              onClick={() => {
                const path = `/farm/${farmSlug}/checkout`
                if (user) navigate(path)
                else openLogin({ next: path })
              }}
            >
              주문하기
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const BRAND_SUB = '농가 직송'
