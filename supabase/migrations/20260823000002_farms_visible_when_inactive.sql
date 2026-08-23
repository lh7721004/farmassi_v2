-- 비활성 농가도 손님이 볼 수 있게 한다.
--
-- 기존 정책은 is_active=true 인 농가만 보여줬다. 그래서 농가를 비활성화하면
-- 랜딩·주문 페이지가 "농가를 찾을 수 없습니다" 가 되어, 사용자는 주소를 잘못
-- 눌렀다고 오해한다.
--
-- 비활성은 "주문을 받지 않는다" 는 뜻이지 "존재하지 않는다" 가 아니다.
-- 조회는 열어 두고 주문은 서버(create-order)와 화면에서 막는다.
drop policy if exists farms_select on public.farms;

create policy farms_select on public.farms
  for select using (true);

-- 상품도 같은 이유로 연다.
-- 기존 정책은 농가가 비활성이면 상품을 통째로 가려서, 화면에 "판매 중인 상품이
-- 없습니다" 만 남았다. 상품 자체의 노출 여부(is_active)는 그대로 지킨다.
drop policy if exists products_select on public.products;

create policy products_select on public.products
  for select using (
    is_active = true
    or private.is_admin()
    or private.is_farm_member(farm_id)
  );
