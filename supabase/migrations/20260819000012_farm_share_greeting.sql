update public.farms
set share_text = '안녕하세요' || E'\n' || ltrim(share_text)
where share_text is not null
  and btrim(share_text) <> ''
  and ltrim(share_text) !~ '^안녕하세요';
