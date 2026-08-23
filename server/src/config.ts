function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`환경변수 ${name} 이 없습니다.`)
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const config = {
  port: Number(optional('PORT', '4310')),

  // 두 개의 접속 정보를 쓴다.
  //   app   : RLS 가 적용되는 역할. 사용자 요청 처리용.
  //   admin : RLS 를 우회하는 역할. 서버 내부 작업(주문 생성, 입금 대사 등)용.
  dbAppUrl: optional('DATABASE_URL_APP', 'postgres://farmassi_app@localhost:5432/farmassi'),
  dbAdminUrl: optional('DATABASE_URL_ADMIN', 'postgres://farmassi_admin@localhost:5432/farmassi'),

  // 세션 토큰 서명 키. 바뀌면 기존 로그인이 전부 풀린다.
  get jwtSecret() { return required('JWT_SECRET') },
  sessionDays: Number(optional('SESSION_DAYS', '30')),

  kakao: {
    get clientId() { return required('KAKAO_REST_API_KEY') },
    clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
    redirectUri: optional('KAKAO_REDIRECT_URI', 'https://api.shop.lkim.me/auth/kakao/callback'),
  },

  /**
   * 허용할 프론트 출처. 쉼표로 여러 개를 넣을 수 있다.
   * 도메인을 옮기는 동안 옛 주소와 새 주소가 함께 동작해야 하기 때문이다.
   * 첫 번째 값이 대표 주소로, 돌아갈 곳을 못 정했을 때 쓰인다.
   */
  get siteOrigins(): string[] {
    return optional('SITE_ORIGIN', 'https://shop.lkim.me')
      .split(',')
      .map((value) => value.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  },
  get siteOrigin(): string {
    return this.siteOrigins[0]
  },
  uploadDir: optional('UPLOAD_DIR', '/opt/homebrew/var/www/shop-uploads'),
  publicUploadBase: optional('PUBLIC_UPLOAD_BASE', 'https://api.shop.lkim.me/files'),
}
