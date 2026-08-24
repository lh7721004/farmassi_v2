import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorText, PageSpinner } from '../../components/ui/Feedback'
import { markProfilePending } from '../../lib/profileCompletion'
import { supabase } from '../../lib/supabase'

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export function AuthCallback() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const next = safeNext(params.get('next') || sessionStorage.getItem('farmassi-next'))
    let done = false

    function go(path: string) {
      if (done) return
      done = true
      sessionStorage.removeItem('farmassi-next')
      navigate(path, { replace: true })
    }

    async function finish() {
      const oauthError = params.get('error_description') || params.get('error')
      if (oauthError) {
        setError(oauthError)
        return
      }

      const code = params.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          const { data } = await supabase.auth.getSession()
          if (data.session) {
            if (params.get('profile') === '1') markProfilePending()
            go(next)
            return
          }
          setError(exchangeError.message)
          return
        }
        if (params.get('profile') === '1') markProfilePending()
        go(next)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session) {
        go(next)
        return
      }
      go('/')
    }

    void finish()
  }, [navigate, params])

  if (error) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 px-4">
        <ErrorText>{error}</ErrorText>
        <Link to="/" className="text-sm font-semibold text-primary">
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  return <PageSpinner label="로그인 처리 중..." />
}
