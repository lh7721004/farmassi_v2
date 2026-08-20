update public.farms
set share_text = replace(
  replace(
    share_text,
    '👇 💬 카카오톡 문의와 주문하러가기[클릭] 👇',
    '👇 문의, 주문하러가기[클릭] 👇'
  ),
  '👇 주문하러가기[클릭] 👇',
  '👇 문의, 주문하러가기[클릭] 👇'
)
where share_text like '%👇 💬 카카오톡 문의와 주문하러가기[클릭] 👇%'
   or share_text like '%👇 주문하러가기[클릭] 👇%';
