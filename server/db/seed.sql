-- 화면을 채워보기 위한 더미 데이터.
--   server/db/seed.sql  — 실행하면 기존 더미를 지우고 다시 넣는다.
-- 실제 로그인한 계정(카카오)은 건드리지 않는다.

select set_config('request.jwt.claims', '{"role":"service_role"}', false);

-- 이전 더미 정리 (카카오로 만들어진 계정은 auth.identities 에 있으므로 남긴다)
delete from shipments where order_id in (select id from orders);
delete from order_items;
delete from deposit_transactions;
delete from notifications;
delete from orders;
delete from products;
delete from farm_members where user_id in (select id from auth.users where email like '%@seed.test');
delete from farms;
delete from saved_addresses where user_id in (select id from auth.users where email like '%@seed.test');
delete from auth.users where email like '%@seed.test';

-- 사람들 ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001','sunhee@seed.test','{"nickname":"최선희"}'),
  ('a0000000-0000-4000-8000-000000000002','minjun@seed.test','{"nickname":"정민준"}'),
  ('a0000000-0000-4000-8000-000000000003','seoyeon@seed.test','{"nickname":"이서연"}'),
  ('a0000000-0000-4000-8000-000000000004','farmer1@seed.test','{"nickname":"강동수"}'),
  ('a0000000-0000-4000-8000-000000000005','farmer2@seed.test','{"nickname":"오해심"}');

-- 농가 -----------------------------------------------------------------------
insert into farms (id, slug, name, owner_user_id, location, product_summary, description,
                   bank_name, account_number, account_holder, is_active) values
  ('b0000000-0000-4000-8000-000000000001','haneul-farm','하늘농원',
   'a0000000-0000-4000-8000-000000000004','경북 청송군','사과·자두',
   '해발 400m 고랭지에서 키운 사과입니다. 일교차가 커서 단단하고 답니다.',
   '농협','3522405606253','강동수',true),
  ('b0000000-0000-4000-8000-000000000002','baram-farm','바람들녘',
   'a0000000-0000-4000-8000-000000000005','전남 해남군','고구마·양파',
   '해풍 맞고 자란 밤고구마입니다. 수확 후 저온 숙성해서 보냅니다.',
   '농협','3561423564963','오해심',true);

insert into farm_members (farm_id, user_id, member_role) values
  ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','owner'),
  ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000005','owner');

-- 상품 -----------------------------------------------------------------------
insert into products (id, farm_id, name, price, unit, description, sale_status, parcel_weight_kg, sort_order) values
  ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','꿀사과 5kg (13~15과)',32000,'박스','당도 14brix 이상만 골라 담습니다.','on_sale',5,1),
  ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','꿀사과 10kg (26~30과)',58000,'박스','넉넉하게 드실 분께.','on_sale',10,2),
  ('c0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001','못난이 사과 5kg',19000,'박스','흠집만 있고 맛은 같습니다. 주스용으로 좋아요.','sold_out',5,3),
  ('c0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001','햇자두 3kg',28000,'박스','7월 한정.','coming_soon',3,4),
  ('c0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','밤고구마 5kg',24000,'박스','저온 숙성 30일.','on_sale',5,1),
  ('c0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000002','밤고구마 10kg',43000,'박스','','on_sale',10,2),
  ('c0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000002','햇양파 10kg',18000,'망','','on_sale',10,3);

-- 주문 -----------------------------------------------------------------------
-- 상태를 골고루 깔아서 각 화면(입금대기/출고/배송/완료)이 비어 보이지 않게 한다.
insert into orders (id, order_no, farm_id, customer_id, status, recipient_name, recipient_phone,
                    zonecode, address, address_detail, request_memo,
                    total_amount, deposit_due_amount, deposit_code,
                    deposit_confirmed_at, deposit_provider, created_at) values
  ('d0000000-0000-4000-8000-000000000001','FA20260817-4K2M','b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001','completed','최선희','01023456789','06236','서울 강남구 테헤란로 152','302호',
   '부재 시 경비실에 맡겨주세요',64000,64000,'H7QP2M', now() - interval '2 day','manual', now() - interval '3 day'),
  ('d0000000-0000-4000-8000-000000000002','FA20260818-9XR3','b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002','shipping','정민준','01034567890','13529','경기 성남시 분당구 판교역로 235',null,
   null,32000,32000,'K3MW8T', now() - interval '1 day','bankda', now() - interval '2 day'),
  ('d0000000-0000-4000-8000-000000000003','FA20260819-2TQ7','b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000003','packing','이서연','01045678901','48058','부산 해운대구 센텀중앙로 79','1204호',
   '문 앞에 놔주세요',43000,43000,'R9ZK4D', now() - interval '6 hour','bankda', now() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000004','FA20260819-8BN5','b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001','paid','최선희','01023456789','06236','서울 강남구 테헤란로 152','302호',
   null,24000,24000,'T5XA3P', now() - interval '2 hour','bankda', now() - interval '5 hour'),
  ('d0000000-0000-4000-8000-000000000005','FA20260819-6WC1','b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002','pending_deposit','정민준','01034567890','13529','경기 성남시 분당구 판교역로 235',null,
   null,58000,58000,'M2VJ7Q', null,null, now() - interval '40 minute'),
  ('d0000000-0000-4000-8000-000000000006','FA20260819-3HD9','b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000003','pending_deposit','이서연','01045678901','48058','부산 해운대구 센텀중앙로 79','1204호',
   '선물용 포장 부탁드려요',18000,18000,'C8LB6N', null,null, now() - interval '15 minute');

insert into order_items (order_id, product_id, product_name, unit, unit_price, quantity, line_amount) values
  ('d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','꿀사과 5kg (13~15과)','박스',32000,2,64000),
  ('d0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001','꿀사과 5kg (13~15과)','박스',32000,1,32000),
  ('d0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000006','밤고구마 10kg','박스',43000,1,43000),
  ('d0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000005','밤고구마 5kg','박스',24000,1,24000),
  ('d0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000002','꿀사과 10kg (26~30과)','박스',58000,1,58000),
  ('d0000000-0000-4000-8000-000000000006','c0000000-0000-4000-8000-000000000007','햇양파 10kg','망',18000,1,18000);

insert into shipments (order_id, provider, status, tracking_number, requested_at) values
  ('d0000000-0000-4000-8000-000000000001','kpost','printed','6812345678901', now() - interval '2 day'),
  ('d0000000-0000-4000-8000-000000000002','kpost','requested','6812345678902', now() - interval '1 day');

-- 입금 내역 -------------------------------------------------------------------
-- 뱅크다에서 들어온 것처럼. 마지막 한 건은 일부러 대사 실패로 남겨 관리자 화면을 채운다.
insert into deposit_transactions (farm_id, provider, external_id, occurred_at, amount,
                                  depositor_name, raw_payload, matched_order_id, match_status) values
  ('b0000000-0000-4000-8000-000000000001','bankda','900001', now() - interval '1 day', 32000,
   '정민준','{"source":"bankda","match_reason":"amount_unique"}','d0000000-0000-4000-8000-000000000002','matched'),
  ('b0000000-0000-4000-8000-000000000002','bankda','900002', now() - interval '6 hour', 43000,
   '이서연','{"source":"bankda","match_reason":"amount_unique"}','d0000000-0000-4000-8000-000000000003','matched'),
  ('b0000000-0000-4000-8000-000000000002','bankda','900003', now() - interval '2 hour', 24000,
   '최선희','{"source":"bankda","match_reason":"recipient_name"}','d0000000-0000-4000-8000-000000000004','matched'),
  ('b0000000-0000-4000-8000-000000000002','bankda','900004', now() - interval '20 minute', 30000,
   '박서준','{"source":"bankda","match_reason":"no_amount_match"}',null,'unmatched');

-- 알림 -----------------------------------------------------------------------
insert into notifications (user_id, farm_id, order_id, type, title, body, created_at) values
  ('a0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000005',
   'order_created','새 주문(입금대기)','정민준님이 ₩58,000 주문했습니다. 입금자명 M2VJ7Q', now() - interval '40 minute'),
  ('a0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000006',
   'order_created','새 주문(입금대기)','이서연님이 ₩18,000 주문했습니다. 입금자명 C8LB6N', now() - interval '15 minute'),
  ('a0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000004',
   'deposit_confirmed','입금 확인됨, 출고 준비','FA20260819-8BN5 입금이 확인되었습니다. 포장을 시작해주세요.', now() - interval '2 hour');

-- 저장된 주소 -----------------------------------------------------------------
insert into saved_addresses (user_id, recipient_name, phone, zonecode, address, address_detail, is_default, last_used_at) values
  ('a0000000-0000-4000-8000-000000000001','최선희','01023456789','06236','서울 강남구 테헤란로 152','302호',true, now() - interval '2 hour'),
  ('a0000000-0000-4000-8000-000000000002','정민준','01034567890','13529','경기 성남시 분당구 판교역로 235',null,true, now() - interval '40 minute');

-- 농가 상세 -------------------------------------------------------------------
-- landing_blocks 가 비어 있으면 화면이 폴백 히어로 하나로 끝난다. 실제로 읽을거리를 넣는다.
-- 이미지는 server/db/make_seed_images.py 로 만든다.

update farms set
  description = '해발 400미터 청송 산자락에서 사과만 22년 지었습니다. 낮과 밤 기온이 15도 넘게 벌어지는 곳이라 사과가 천천히 익고, 그만큼 단단하고 답니다.',
  product_summary = '사과(홍로·부사), 자두',
  phone = '054-873-1234',
  mobile_phone = '010-2345-6789',
  address = '경북 청송군 현서면 사과길 45',
  address_detail = '하늘농원',
  address_zonecode = '37423',
  map_url = 'https://map.kakao.com/link/search/청송 현서면 사과길 45',
  kakao_channel_url = 'https://pf.kakao.com/_haneulfarm',
  share_text = '청송 하늘농원 꿀사과입니다. 주문 받고 다음날 따서 보내드려요.',
  landing_blocks = jsonb_build_array(
    jsonb_build_object('id','h1',
      'image_url','https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000001/landing-1.jpg',
      'body','해발 400미터, 경북 청송입니다.

여기는 낮과 밤 기온 차가 15도 넘게 납니다. 사과가 천천히 익습니다. 남들보다 2주 늦게 따는 대신, 살이 단단하고 아삭한 소리가 다릅니다.

22년째 이 밭에서 사과만 지었습니다.'),
    jsonb_build_object('id','h2',
      'image_url','https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000001/landing-2.jpg',
      'body','한 알씩 손으로 확인합니다.

당도계로 재서 14brix가 안 나오면 뺍니다. 크기가 고르지 않아도 단맛이 안 맞으면 안 보냅니다. 기계 선별로는 이게 안 됩니다.

그래서 하루에 나가는 양이 정해져 있습니다.'),
    jsonb_build_object('id','h3',
      'image_url','https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000001/landing-3.jpg',
      'body','주문을 받고 나서 땁니다.

창고에 미리 쌓아두지 않습니다. 오늘 주문하시면 내일 아침에 따서 그날 부칩니다. 보통 이틀이면 받으십니다.

그래서 주말 주문은 월요일에 나갑니다. 하루 이틀 늦어지는 건 이 때문입니다.'),
    jsonb_build_object('id','h4',
      'image_url','https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000001/landing-4.jpg',
      'body','흠집 난 것은 따로 팝니다.

우박 맞거나 가지에 긁힌 사과는 못난이로 반값에 내놓습니다. 맛은 똑같습니다. 주스나 잼 하실 분들이 많이 찾으십니다.

버리는 게 아까워서 시작했는데 이제는 이쪽이 더 빨리 나갑니다.')
  )
where id = 'b0000000-0000-4000-8000-000000000001';

update farms set
  description = '해남 황토밭에서 고구마를 캡니다. 캐자마자 보내지 않고 30일 숙성해서 나갑니다. 전분이 당으로 바뀌는 데 그만큼 걸립니다.',
  product_summary = '밤고구마, 햇양파',
  phone = '061-535-7788',
  mobile_phone = '010-3456-7890',
  address = '전남 해남군 산이면 들녘로 210',
  address_detail = '바람들녘 작업장',
  address_zonecode = '59021',
  map_url = 'https://map.kakao.com/link/search/해남 산이면 들녘로 210',
  kakao_channel_url = 'https://pf.kakao.com/_baramfield',
  share_text = '해남 바람들녘 밤고구마입니다. 30일 숙성해서 보냅니다.',
  landing_blocks = jsonb_build_array(
    jsonb_build_object('id','b1',
      'image_url','https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000002/landing-1.jpg',
      'body','해남 황토밭입니다.

바다가 가까워서 바람에 소금기가 섞여 옵니다. 이런 데서 자란 고구마가 단맛이 진합니다. 흙도 물 빠짐이 좋은 황토라 속이 무릅니다.

밭 이름을 바람들녘이라고 붙인 이유입니다.'),
    jsonb_build_object('id','b2',
      'image_url','https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000002/landing-2.jpg',
      'body','캐고 나서 30일을 둡니다.

갓 캔 고구마는 안 답니다. 전분이 당으로 바뀌는 데 시간이 걸립니다. 13도 창고에 한 달 두면 그때부터 단맛이 올라옵니다.

급하게 팔면 이 한 달을 못 기다립니다. 저희는 기다립니다.'),
    jsonb_build_object('id','b3',
      'image_url','https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000002/landing-3.jpg',
      'body','흙만 털어서 보냅니다.

씻어서 보내면 보기는 좋은데 금방 무릅니다. 껍질에 상처가 나서 그렇습니다. 그래서 흙만 털어 보냅니다.

받으시면 서늘한 데 두시고, 드시기 직전에 씻으세요. 냉장고에 넣으면 오히려 맛이 떨어집니다.'),
    jsonb_build_object('id','b4',
      'image_url','https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000002/landing-4.jpg',
      'body','크기를 맞춰 담습니다.

한 상자에 큰 것과 작은 것을 섞으면 굽는 시간이 달라집니다. 작은 건 타고 큰 건 덜 익습니다.

그래서 상자마다 비슷한 크기끼리 담습니다. 중·소 위주로 나가는 이유이기도 합니다.')
  )
where id = 'b0000000-0000-4000-8000-000000000002';

-- 상품 상세 -------------------------------------------------------------------
update products set description = '13~15과가 들어갑니다. 4인 가족이 일주일 드실 양입니다.
당도계로 재서 14brix 이상만 담았습니다. 껍질째 드셔도 됩니다.
받으시면 서늘한 데 두세요. 냉장 보관하면 3주까지 갑니다.',
  image_url = 'https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000001/product-apple-5kg.jpg'
  where id = 'c0000000-0000-4000-8000-000000000001';
update products set description = '26~30과가 들어갑니다. 5kg 두 상자보다 6천원 쌉니다.
나눠 드시거나 오래 두고 드실 분께 권합니다.
박스가 무거우니 받으실 때 참고하세요.',
  image_url = 'https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000001/product-apple-10kg.jpg'
  where id = 'c0000000-0000-4000-8000-000000000002';
update products set description = '우박 맞거나 가지에 긁힌 사과입니다. 겉만 그렇고 속은 멀쩡합니다.
당도는 정품과 같은 기준으로 골랐습니다.
주스, 잼, 청 담그실 분들이 주로 찾으십니다. 선물용으로는 권하지 않습니다.',
  image_url = 'https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000001/product-apple-ugly.jpg'
  where id = 'c0000000-0000-4000-8000-000000000003';
update products set description = '7월 중순부터 2주 정도만 나옵니다.
무르기 쉬워서 조금 덜 익은 상태로 보냅니다. 하루 이틀 실온에 두시면 알맞습니다.
오픈 알림을 원하시면 카카오 채널로 말씀해 주세요.',
  image_url = 'https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000001/product-plum.jpg'
  where id = 'c0000000-0000-4000-8000-000000000004';
update products set description = '30일 숙성한 밤고구마입니다. 중·소 위주로 담습니다.
에어프라이어 180도 25분이면 속까지 익습니다.
흙이 묻은 채로 갑니다. 드시기 직전에 씻으세요.',
  image_url = 'https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000002/product-sweet-5kg.jpg'
  where id = 'c0000000-0000-4000-8000-000000000005';
update products set description = '5kg 두 상자보다 5천원 쌉니다.
서늘하고 바람 통하는 데 두시면 한 달은 갑니다. 냉장고는 피하세요, 맛이 떨어집니다.
많이 드시는 집이나 나눠 드실 분께 권합니다.',
  image_url = 'https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000002/product-sweet-10kg.jpg'
  where id = 'c0000000-0000-4000-8000-000000000006';
update products set description = '6월에 캔 햇양파입니다. 망에 담아 보냅니다.
매운맛이 적어서 생으로 썰어 드셔도 됩니다.
습기가 있으면 무릅니다. 망째로 걸어두시는 게 제일 낫습니다.',
  image_url = 'https://api.shop.lkim.me/files/b0000000-0000-4000-8000-000000000002/product-onion.jpg'
  where id = 'c0000000-0000-4000-8000-000000000007';

-- 연동 시험용 상품 -------------------------------------------------------------
-- 뱅크다에 등록된 계좌(3522405606253)를 쓰는 하늘농원에 붙인다.
-- 실제로 1원을 이체해서 자동 입금확인이 도는지 확인하는 용도.
insert into products (id, farm_id, name, price, unit, description, sale_status, parcel_weight_kg, sort_order) values
  ('c0000000-0000-4000-8000-000000000091','b0000000-0000-4000-8000-000000000001','[시험] 1원 상품',1,'개',
   '입금 자동확인 연동 시험용입니다. 실제 배송되지 않습니다.','on_sale',3,90),
  ('c0000000-0000-4000-8000-000000000092','b0000000-0000-4000-8000-000000000001','[시험] 5원 상품',5,'개',
   '입금 자동확인 연동 시험용입니다. 실제 배송되지 않습니다.','on_sale',3,91),
  ('c0000000-0000-4000-8000-000000000093','b0000000-0000-4000-8000-000000000001','[시험] 10원 상품',10,'개',
   '입금 자동확인 연동 시험용입니다. 실제 배송되지 않습니다.','on_sale',3,92)
on conflict (id) do nothing;
