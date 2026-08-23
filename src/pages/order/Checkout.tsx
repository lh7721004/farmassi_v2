import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AddressPicker } from '../../components/shared/AddressPicker'
import { Input } from '../../components/ui/Field'
import { PhoneField } from '../../components/ui/PhoneField'
import { RequestMemoField } from '../../components/ui/RequestMemoField'
import { ErrorText, PageSpinner } from '../../components/ui/Feedback'
import { clearCart, getCart } from '../../lib/cart'
import { formatPrice } from '../../lib/format'
import { invokeFunction } from '../../lib/functions'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { isProductOrderable, type Farm, type Product, type SavedAddress } from '../../types/models'

interface CheckoutResult {
  orderId: string
}

export function Checkout() {
  const { farmSlug = '' } = useParams()
  const navigate = useNavigate()
  const { user, profile, refresh } = useAuth()
  const [farm, setFarm] = useState<Farm | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new'>('new')
  const [saveAddress, setSaveAddress] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    recipient_name: '',
    phone: '',
    zonecode: '',
    address: '',
    address_detail: '',
    request_memo: '',
  })

  const cart = getCart(farmSlug)
  const qtyById = useMemo(
    () => Object.fromEntries(cart.map((item) => [item.productId, item.quantity])),
    [cart],
  )

  useEffect(() => {
    async function load() {
      const { data: farmRow } = await supabase.from('farms').select('*').eq('slug', farmSlug).maybeSingle()
      const farmData = farmRow as Farm | null
      setFarm(farmData)
      if (farmData) {
        const { data: productRows } = await supabase
          .from('products')
          .select('*')
          .eq('farm_id', farmData.id)
          .eq('sale_status', 'on_sale')
        setProducts((productRows as Product[]) ?? [])
      }
      if (user) {
        const { data: addrRows } = await supabase
          .from('saved_addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('last_used_at', { ascending: false })
        const list = uniqueSavedAddresses((addrRows as SavedAddress[]) ?? [])
        setAddresses(list)
        const def = list.find((a) => a.is_default) ?? list[0]
        if (def) applyAddress(def)
      }
      setLoading(false)
    }
    void load()
  }, [farmSlug, user])

  function applyAddress(addr: SavedAddress) {
    setSelectedAddressId(addr.id)
    setForm((prev) => ({
      ...prev,
      recipient_name: addr.recipient_name,
      phone: addr.phone,
      zonecode: addr.zonecode ?? '',
      address: addr.address,
      address_detail: addr.address_detail ?? '',
    }))
  }

  const lines = products
    .filter((product) => isProductOrderable(product) && (qtyById[product.id] ?? 0) > 0)
    .map((product) => ({
      product,
      quantity: qtyById[product.id] ?? 0,
    }))
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0)

  if (loading) return <PageSpinner />
  if (pending) return <PageSpinner label="주문을 처리하는 중..." />
  if (!farm) {
    return <div className="min-h-dvh flex items-center justify-center text-muted">농가를 찾을 수 없습니다</div>
  }
  if (lines.length === 0) {
    return (
      <div className="min-h-dvh bg-surface">
        <Header title="주문하기" showBack backTo={`/farm/${farmSlug}`} />
        <div className="px-4 py-10 text-center text-muted">
          담긴 상품이 없습니다.{' '}
          <Link className="text-primary font-semibold" to={`/farm/${farmSlug}`}>
            상품 선택하기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface pb-10">
      <Header title="주문하기" showBack backTo={`/farm/${farmSlug}`} />
      <form
        className="px-4 py-4 md:px-6 max-w-lg mx-auto space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          if (!form.address.trim()) {
            setError('배송지를 현재 위치 또는 검색으로 설정해 주세요.')
            return
          }
          setPending(true)
          try {
            const result = await invokeFunction<CheckoutResult>('create-order', {
              farmId: farm.id,
              items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
              recipient: {
                name: form.recipient_name,
                phone: form.phone,
                zonecode: form.zonecode,
                address: form.address,
                addressDetail: form.address_detail,
              },
              requestMemo: form.request_memo,
              saveAddress: alreadySavedAddress(addresses, form) ? false : selectedAddressId === 'new' && saveAddress,
            })
            clearCart(farmSlug)
            await refresh()
            navigate(`/me/orders/${result.orderId}/complete`, { replace: true })
          } catch (err) {
            setError(err instanceof Error ? err.message : '주문에 실패했습니다.')
            setPending(false)
          }
        }}
      >
        <Card>
          <h3 className="font-semibold mb-3">주문 상품 · {farm.name}</h3>
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.product.id} className="flex justify-between text-sm">
                <span>
                  {line.product.name} {line.product.unit} ×{line.quantity}
                </span>
                <span className="font-medium">{formatPrice(line.product.price * line.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between font-bold">
            <span>합계</span>
            <span className="text-primary">{formatPrice(total)}</span>
          </div>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold">배송지</h3>
          {addresses.length > 0 && (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <button
                  type="button"
                  key={addr.id}
                  onClick={() => applyAddress(addr)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    selectedAddressId === addr.id ? 'border-primary bg-primary-light' : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium">
                    {addr.recipient_name} · {addr.phone}
                    {addr.is_default ? ' (기본)' : ''}
                  </p>
                  <p className="text-muted">
                    {addr.address} {addr.address_detail}
                  </p>
                </button>
              ))}
              <button
                type="button"
                className="text-sm text-primary font-medium"
                onClick={() => {
                  setSelectedAddressId('new')
                  setForm((prev) => ({
                    ...prev,
                    recipient_name: profile?.display_name ?? '',
                    phone: profile?.phone ?? '',
                    zonecode: '',
                    address: '',
                    address_detail: '',
                  }))
                }}
              >
                새 주소 입력
              </button>
            </div>
          )}
          <Input
            label="받는 분"
            value={form.recipient_name}
            onChange={(e) => setForm((p) => ({ ...p, recipient_name: e.target.value }))}
            required
          />
          <PhoneField
            label="전화번호"
            value={form.phone}
            onChange={(phone) => setForm((p) => ({ ...p, phone }))}
            required
          />
          <AddressPicker
            value={{
              zonecode: form.zonecode,
              address: form.address,
              addressDetail: form.address_detail,
            }}
            onChange={(next) => {
              if (next.address !== form.address || next.zonecode !== form.zonecode) {
                setSelectedAddressId('new')
              }
              setForm((p) => ({
                ...p,
                zonecode: next.zonecode,
                address: next.address,
                address_detail: next.addressDetail,
              }))
            }}
          />
          <RequestMemoField
            label="요청사항"
            value={form.request_memo}
            onChange={(request_memo) => setForm((p) => ({ ...p, request_memo }))}
          />
          {selectedAddressId === 'new' && !alreadySavedAddress(addresses, form) && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
                className="rounded accent-primary"
              />
              이 주소를 계정에 저장하고 다음에 사용
            </label>
          )}
        </Card>

        <Card className="bg-primary-light border-primary/20">
          <p className="text-sm text-gray-800">
            주문이 완료되면 입금할 농가 계좌를 안내해 드립니다. 입금 확인 후 출고가 진행됩니다.
          </p>
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button type="submit" fullWidth size="lg" disabled={pending || !farm?.is_active}>
          {!farm?.is_active ? '지금은 주문을 받지 않습니다' : `${formatPrice(total)} 주문하기`}
        </Button>
      </form>
    </div>
  )
}

function normalizeAddressPart(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

function addressKey(address: string, detail?: string | null, zonecode?: string | null) {
  return `${normalizeAddressPart(address)}|${normalizeAddressPart(detail)}|${normalizeAddressPart(zonecode)}`
}

function alreadySavedAddress(
  list: SavedAddress[],
  form: { address: string; address_detail: string; zonecode: string },
) {
  const key = addressKey(form.address, form.address_detail, form.zonecode)
  return list.some((addr) => addressKey(addr.address, addr.address_detail, addr.zonecode) === key)
}

function uniqueSavedAddresses(list: SavedAddress[]) {
  const seen = new Map<string, SavedAddress>()
  for (const addr of list) {
    const key = addressKey(addr.address, addr.address_detail, addr.zonecode)
    const prev = seen.get(key)
    if (!prev) {
      seen.set(key, addr)
      continue
    }
    const addrUsed = addr.last_used_at ?? addr.created_at
    const prevUsed = prev.last_used_at ?? prev.created_at
    if (addr.is_default && !prev.is_default) seen.set(key, addr)
    else if (addr.is_default === prev.is_default && addrUsed > prevUsed) seen.set(key, addr)
  }
  return [...seen.values()]
}
