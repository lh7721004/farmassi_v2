// 공유 문구의 랜딩 링크가 이 주소를 쓴다. 배포 도메인이 바뀌면 .env 만 고치면 된다.
const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'https://farmassi.kr').replace(/\/+$/, '')

export const BRAND = {
  serviceName: '팜어시',
  serviceNameEn: 'Farmassi',
  companyName: '스테이블 퓨전',
  companyNameEn: 'Stable Fusion',
  tagline: '농가 직송 신선 농산물',
  siteUrl: SITE_URL,
} as const

