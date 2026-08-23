import { useEffect, useState } from 'react'

interface BackendVersion {
  version: string
  commit: string
  startedAt: string
}

/**
 * 지금 돌고 있는 프론트·백엔드 버전.
 *
 * 배포가 실제로 반영됐는지 화면에서 바로 확인하려는 것이다. 둘을 따로 보여주는
 * 이유는 프론트(Vercel)와 백엔드(이 서버)가 각각 배포되기 때문이다.
 */
export function VersionBadge() {
  const [backend, setBackend] = useState<BackendVersion | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL ?? ''
    fetch(`${base}/version`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setBackend)
      .catch(() => setFailed(true))
  }, [])

  return (
    <div className="px-4 pb-6 md:px-6 max-w-5xl mx-auto">
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
        <div className="flex gap-2">
          <dt>프론트</dt>
          <dd className="font-mono text-gray-700">
            v{__APP_VERSION__} <span className="text-muted">({__APP_COMMIT__})</span>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt>백엔드</dt>
          <dd className="font-mono text-gray-700">
            {backend
              ? <>v{backend.version} <span className="text-muted">({backend.commit})</span></>
              : failed
                ? <span className="text-amber-700">연결 안 됨</span>
                : '확인 중…'}
          </dd>
        </div>
        {backend && (
          <div className="flex gap-2">
            <dt>백엔드 기동</dt>
            <dd className="text-gray-700">
              {new Date(backend.startedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
