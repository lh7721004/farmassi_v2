# 팜어시 (Farmassi)

농가별 주문 페이지, 무통장 입금, 농가 알림, 관리자 운영을 위한 주문·배송 플랫폼입니다.

## 로컬 실행

```bash
cp .env.example .env.local
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`

## 역할

- **주문자 / 농가**: 카카오 로그인
- **관리자**: 지정된 카카오 계정만 (`/admin/login` 또는 로그인 후 `/admin`)

## 화면

- `/farm/:farmSlug` — 농가 주문 페이지
- `/manage` — 농가 주문·배송 (계정에 연결된 농가)
- `/admin` — 주문·입금·농가 전체 관리
- `/admin/farms` — 농가 생성 및 담당 계정 연결

## 처음 쓰는 순서

1. [카카오 디벨로퍼스](https://developers.kakao.com/console/app)에서 앱을 만들고 **카카오 로그인을 ON** 합니다.
2. REST API 키의 Redirect URI에 **Supabase 콜백만** 등록합니다.
   - `https://pfysjhabkqwfytzpsbom.supabase.co/auth/v1/callback`
3. REST API 키에서 **Client Secret을 활성화**하고 값을 복사합니다.
4. [카카오 로그인] → [동의항목]에서 **닉네임**(`profile_nickname`), **프로필 사진**(`profile_image`)을 [설정]으로 켜 둡니다. 필수·선택 어느 쪽이든 됩니다. `account_email`은 비즈 앱이 아니면 요청하지 않습니다.
5. Supabase Dashboard → Authentication → Providers → Kakao를 켭니다.
   - Client ID: 카카오 REST API 키
   - Client Secret: 카카오 Client Secret
   - 이메일 없이 로그인 허용(Allow users without an email): ON (`account_email`을 안 쓰면 필수)
6. Authentication → URL Configuration
   - Site URL: `https://farmassi.kr`
   - Redirect URLs: `http://localhost:5173/**`, `https://farmassi.kr/**`, `https://www.farmassi.kr/**`

7. 배송지 검색용 **네이버 지도**를 켭니다.
   - [네이버 클라우드](https://console.ncloud.com) → Maps → Application에서 Dynamic Map, Geocoding, Reverse Geocoding을 선택합니다.
   - Web 서비스 URL: `http://localhost`, `http://farmassi.kr`
   - Client ID는 `.env.local`의 `VITE_NAVER_MAP_CLIENT_ID`에 넣습니다.
   - Client Secret은 프론트에 넣지 말고 Edge Function 시크릿 `NAVER_MAP_CLIENT_SECRET`으로 등록합니다.

8. Authentication → Providers → Email에서 **공개 회원가입은 끕니다.** 관리자는 카카오로 로그인한 뒤, 해당 사용자만 `profiles.role` 을 `admin` 으로 올립니다. 다른 카카오 계정은 관리자 페이지에 들어갈 수 없습니다.

```sql
update public.profiles
   set role = 'admin'
 where id = '<auth user uuid>';
```

9. 관리자 → **농가**에서 농가를 만들고, 카카오로 이미 로그인한 담당 계정을 연결합니다. 연결된 계정만 `/manage` 에 들어갑니다.

10. (선택) 웹 푸시용 VAPID 비밀키를 Edge Function 시크릿으로 등록합니다.

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... --project-ref pfysjhabkqwfytzpsbom
```

웹 푸시는 브라우저 권한·iOS 홈화면 추가 여부에 따라 100% 보장되지 않습니다. 농가 페이지가 열려 있으면 Realtime 인앱 알림이 동작합니다.

## 이후 연동 (기반만 준비됨)

- 우체국 송장: 상품에 저장한 택배 정보로 창구소포 엑셀을 농가별로 다운로드 (`/manage/products`, `/admin/shipments`)
- 계좌 스크래핑(GND, 헥토파이낸셜, 뱅크샐러드, 코드에프): `src/integrations/deposit`, Edge Function `scrape-deposits`
- 입금 확인 공통 진입점: `confirm-deposit`

## 배포

Vercel Framework Preset: Vite, Build: `npm run build`, Output: `dist`

## 뱅크다A 입금 자동확인

무통장입금 내역을 뱅크다A에서 가져와 입금대기 주문에 붙입니다.

### 설정

Edge Function 환경변수:

```
BANKDA_ACCESS_TOKEN=...   # 뱅크다 > 설정 > 데이터전송 관리 > REST API
CRON_SECRET=...           # 크론이 scrape-deposits 를 호출할 때 쓰는 값
```

`farms.account_number` 가 뱅크다에 등록된 계좌번호와 같아야 농가를 찾습니다.
하이픈은 무시하고 숫자만 비교합니다.

### 실행

```bash
supabase db push
supabase functions deploy scrape-deposits

# 크론에서
curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" -d '{"days":3}' \
  https://<project>.supabase.co/functions/v1/scrape-deposits
```

관리자는 로그인 상태로 같은 함수를 호출해 수동 실행할 수 있습니다.

### 매칭 규칙

`_shared/depositMatching.ts` 에 있습니다. **금액이 정확히 같아야** 후보가 되고,
입금자명은 후보를 좁히는 데만 씁니다.

| 상황 | 결과 |
|---|---|
| 금액 일치 주문이 1건 | 자동 확인 (`amount_unique`) |
| 금액 일치 여러 건, 입금자명에 입금코드 있음 | 자동 확인 (`deposit_code`) |
| 금액 일치 여러 건, 입금자명이 수령인과 같음 | 자동 확인 (`recipient_name`) |
| 그 외 | `unmatched` 로 남기고 사람이 확인 |

확실하지 않으면 붙이지 않습니다. 잘못 붙으면 오출고로 이어지지만, 안 붙으면
관리자가 화면에서 확인만 하면 되기 때문입니다.

### 주의

- 뱅크다 거래내역 조회는 **계좌당 5분에 1회**입니다. 크론 간격을 그보다 짧게 두지 마세요.
- 스크래핑 주기(현재 **60분**)만큼 지연이 있습니다. 즉시 알림이 필요하면 푸시 경로를 병행하세요.
- 같은 거래를 두 번 넣지 않도록 `deposit_transactions (provider, external_id)` 에
  유니크 인덱스가 있습니다. `external_id` 는 뱅크다의 `bkcode` 입니다.

---

## 자체 스택 (Supabase 제거)

Supabase 대신 로컬 PostgreSQL + 자체 API 서버로 돌아갑니다.

```
브라우저 ── https://shop.lkim.me ──────► nginx ──► /opt/homebrew/var/www/shop (정적)
         └─ https://api.shop.lkim.me ──► nginx ──► 127.0.0.1:4310 (Node API)
                                                        └──► PostgreSQL 17 (farmassi)
```

### 데이터베이스

`supabase/migrations/` 의 SQL 을 **고치지 않고** 그대로 씁니다. `server/db/000_local_shim.sql`
이 Supabase 가 제공하던 것(`auth.users`, `auth.uid()`, `auth.jwt()`, 역할 4개)만 흉내냅니다.

```bash
server/db/apply.sh          # 마이그레이션 적용
server/db/apply.sh --reset  # 데이터베이스를 지우고 다시 구축
```

**RLS 정책 24개를 그대로 살려뒀습니다.** API 는 요청마다
`set_config('request.jwt.claim.sub', <사용자 id>, true)` 를 걸고 `farmassi_app` 역할로
접속하므로, 인가는 DB 가 계속 검사합니다. 서버 내부 작업만 `farmassi_admin`(BYPASSRLS)으로 나갑니다.

### API 서버

의존성은 `pg` 와 `web-push` 둘뿐입니다. Node 의 타입 스트리핑을 쓰므로 빌드 단계가 없습니다.

| 경로 | 역할 |
|---|---|
| `POST /query` | 데이터 게이트웨이. 프론트의 조회 문법을 SQL 로 옮긴다 |
| `POST /rpc/<이름>` | 기존 Edge Function 7개 |
| `POST /storage/upload`, `/storage/delete` | 이미지 업로드 |
| `GET /files/<경로>` | 업로드된 이미지 서빙 |
| `GET /auth/kakao/start`, `/auth/kakao/callback` | 카카오 로그인 |
| `GET /auth/me` | 현재 사용자 |

환경변수는 `server/.env` 에 있습니다. `KAKAO_REST_API_KEY` 를 채워야 로그인이 됩니다.

### 배포

```bash
npm run build && rsync -a --delete dist/ /opt/homebrew/var/www/shop/
launchctl kickstart -k gui/$(id -u)/me.lkim.farmassi-api    # API 재시작
```

nginx 설정은 `/opt/homebrew/etc/nginx/nginx.conf` 에 있고, 원본 백업과 추가한 블록은
`deploy/` 에 있습니다. 인증서는 certbot(`~/letsencrypt/config/live/shop.lkim.me`)으로 발급했습니다.

### 실시간 알림

Postgres 논리복제 대신 15초 폴링으로 대체했습니다 (`src/lib/apiClient.ts` 의 `channel`).
첫 조회는 기존 행을 기록만 하므로 새로고침할 때마다 알림이 다시 뜨지 않습니다.
