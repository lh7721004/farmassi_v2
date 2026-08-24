-- 농가 구성원도 자기 농가를 수정할 수 있게 한다.
--
-- 20260819000002 에서 admin 만 UPDATE 가능하게 좁혔는데, 배송 일시정지·배송요일
-- 같은 운영 설정은 농가 화면에서 걸어야 한다. owner_user_id / slug / is_active 는
-- private.protect_farm_fields() 가 관리자가 아니면 덮어쓰지 못하게 막는다.

drop policy if exists farms_update_admin on public.farms;

create policy farms_update on public.farms
  for update
  using (private.is_admin() or private.is_farm_member(id))
  with check (private.is_admin() or private.is_farm_member(id));
